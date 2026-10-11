"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import socket from "./socket";

/* Everyone in the room is a voice peer, mic or not — listening must not require
   granting a mic. Mic starts muted, so joining is receive-only until you unmute.
   The newcomer offers, existing peers answer — avoids offer glare.
   ponytail: WebRTC mesh + Google STUN only — fine up to ~6-8 people per room.
   Add a TURN server when peers behind symmetric NAT must connect. */
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/* One reserved audio transceiver per peer connection. Module scope on purpose:
   a per-render WeakMap would hand out a second transceiver for the same peer. */
const AUDIO_TX = new WeakMap(); // RTCPeerConnection -> RTCRtpTransceiver

const useVoice = (roomId) => {
  const [muted, setMuted] = useState(true);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  /* true when the browser refused to autoplay a peer's audio — needs one click. */
  const [blocked, setBlocked] = useState(false);
  const streamRef = useRef(null);
  /* peerIds whose offer is still unanswered — offer-glare detection. Per peer,
     not global: a newcomer offers several peers and each needs its own flag. */
  const offerPending = useRef(new Set());
  const peersRef = useRef(new Map()); // peer socketId -> RTCPeerConnection
  const audioRef = useRef(new Map()); // peer socketId -> HTMLAudioElement

  const signal = useCallback(
    (to, data) => {
      socket?.emit("voice-signal", { roomId, to, data });
    },
    [roomId],
  );

  const dropPeer = useCallback((peerId) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    offerPending.current.delete(peerId);
    const el = audioRef.current.get(peerId);
    if (el) {
      el.pause();
      el.srcObject = null;
      el.remove();
      audioRef.current.delete(peerId);
    }
  }, []);

  /* Exactly one audio m-line per peer, reused wherever it came from. Without an
     m-line an offer carries no audio, so a peer's voice could never reach us. */
  const audioTransceiver = (pc) => {
    const known = AUDIO_TX.get(pc);
    if (known) return known;
    /* Prefer one the engine created from the remote description, so unmuting
       later upgrades that m-line instead of adding a second one. */
    const tx =
      pc
        .getTransceivers()
        .find(
          (t) =>
            t.receiver.track?.kind === "audio" || t.sender.track?.kind === "audio",
        ) || pc.addTransceiver("audio", { direction: "recvonly" });
    AUDIO_TX.set(pc, tx);
    return tx;
  };

  /* Point the reserved m-line at the mic. Returns true when a track just
     appeared, which is the only case needing renegotiation. */
  const attachMic = useCallback((pc) => {
    const track = streamRef.current?.getAudioTracks()[0];
    const tx = audioTransceiver(pc);
    if (!track) {
      tx.direction = "recvonly";
      return false;
    }
    if (tx.sender.track === track) return false;
    tx.sender.replaceTrack(track);
    tx.direction = "sendrecv";
    return true;
  }, []);

  const ensurePeer = useCallback(
    (peerId) => {
      let pc = peersRef.current.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, pc);
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          signal(peerId, { candidate: e.candidate });
        }
      };
      pc.ontrack = (e) => {
        let el = audioRef.current.get(peerId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          audioRef.current.set(peerId, el);
          /* Safari/iOS refuse to play a detached element — keep it in the DOM. */
          el.style.display = "none";
          document.body.appendChild(el);
        }
        el.srcObject = e.streams[0];
        el.play().catch(() => setBlocked(true));
      };
      return pc;
    },
    [signal],
  );

  /* One offer in flight per peer. */
  const offerPeer = useCallback(
    async (peerId) => {
      const pc = ensurePeer(peerId);
      if (
        !pc ||
        pc.signalingState !== "stable" ||
        offerPending.current.has(peerId)
      ) {
        return;
      }
      attachMic(pc); // reserve the audio m-line the offer will carry
      offerPending.current.add(peerId);
      try {
        await pc.setLocalDescription(await pc.createOffer());
        signal(peerId, { sdp: pc.localDescription });
      } catch {
        offerPending.current.delete(peerId);
      }
    },
    [ensurePeer, attachMic, signal],
  );

  const toggle = useCallback(async () => {
    if (!socket) return;
    if (!streamRef.current) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        setError(
          "Microphone access denied. Allow the mic in your browser settings, then try again.",
        );
        return;
      }
      /* First click on "Unmute microphone" must transmit, not land muted. */
      streamRef.current.getAudioTracks()[0].enabled = true;
    } else {
      const track = streamRef.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
    }
    const nextMuted = !streamRef.current.getAudioTracks()[0].enabled;
    setMuted(nextMuted);
    socket.emit("voiceMute", { roomId, muted: nextMuted });
    /* Unmuting on an existing peer must renegotiate, or nobody hears you. */
    if (!nextMuted) {
      peersRef.current.forEach((pc, peerId) => {
        if (attachMic(pc)) offerPeer(peerId);
      });
    }
  }, [roomId, attachMic, offerPeer]);

  useEffect(() => {
    if (!roomId || !socket) return;

    /* Join voice on room entry, not on mic grant — that is what lets a silent
       listener hear a speaker. Server relays this to everyone already here. */
    socket.emit("voice-join", { roomId });
    setJoined(true);

    /* The server replies with who was already in voice. We are the newcomer, so
       we offer every one of them — exactly one offer per pair, so N users
       speaking at once never glare. */
    const onVoicePeers = async (peers) => {
      for (const peerId of peers) {
        if (peerId !== socket.id) await offerPeer(peerId);
      }
    };

    const onSignal = async ({ from, data }) => {
      const pc = ensurePeer(from);
      if (!pc) return;
      try {
        if (data.sdp) {
          const collision =
            data.sdp.type === "offer" &&
            (pc.signalingState !== "stable" ||
              offerPending.current.has(from));
          if (collision) {
            /* We sent the higher-priority offer: ignore theirs. Otherwise roll
               back our own and take theirs (perfect-negotiation, polite side). */
            if (from < socket.id) return;
            await pc.setLocalDescription({ type: "rollback" });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            /* Attach our mic before answering. Skipping this answers recvonly
               and the peer never hears us, even though our icon shows unmuted. */
            attachMic(pc);
            await pc.setLocalDescription(await pc.createAnswer());
            signal(from, { sdp: pc.localDescription });
          }
          /* Their answer arrived — our pending offer to them is settled. */
          if (data.sdp.type === "answer") offerPending.current.delete(from);
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error("voice signal error:", err);
      }
    };

    const onUserList = (users) => {
      const live = new Set(users.map((u) => u.socketId));
      [...peersRef.current.keys()].forEach((id) => {
        if (!live.has(id)) dropPeer(id);
      });
    };

    socket.on("voice-peers", onVoicePeers);
    socket.on("voice-signal", onSignal);
    socket.on("userListUpdate", onUserList);
    return () => {
      socket.off("voice-peers", onVoicePeers);
      socket.off("voice-signal", onSignal);
      socket.off("userListUpdate", onUserList);
      [...peersRef.current.keys()].forEach(dropPeer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [roomId, ensurePeer, offerPeer, dropPeer, signal]);
  return { muted, joined, toggle, error, blocked };
};

export default useVoice;
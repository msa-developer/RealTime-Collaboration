"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import socket from "./socket";

/* ponytail: WebRTC mesh + Google STUN only — fine up to ~6-8 people per room.
   Add a TURN server when peers behind symmetric NAT must connect. */
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/* Mic starts muted. First unmute asks for the mic and joins voice; once in,
   user keeps receiving audio while self-muted. Existing voice members always
   send the offer, the joiner answers — avoids offer glare. */
const useVoice = (roomId) => {
  const [muted, setMuted] = useState(true);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef(null);
  const peersRef = useRef(new Map()); // peer socketId -> RTCPeerConnection
  const audioRef = useRef(new Map()); // peer socketId -> HTMLAudioElement

  const dropPeer = useCallback((peerId) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    const el = audioRef.current.get(peerId);
    if (el) {
      el.pause();
      el.srcObject = null;
      audioRef.current.delete(peerId);
    }
  }, []);

  const ensurePeer = useCallback(
    (peerId) => {
      let pc = peersRef.current.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, pc);
      streamRef.current
        .getTracks()
        .forEach((track) => pc.addTrack(track, streamRef.current));
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("voice-signal", {
            roomId,
            to: peerId,
            data: { candidate: e.candidate },
          });
        }
      };
      pc.ontrack = (e) => {
        let el = audioRef.current.get(peerId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          audioRef.current.set(peerId, el);
        }
        el.srcObject = e.streams[0];
        el.play().catch(() => {});
      };
      return pc;
    },
    [roomId],
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
      socket.emit("voice-join", { roomId });
      setJoined(true);
    }
    const track = streamRef.current.getAudioTracks()[0];
    track.enabled = !track.enabled;
    const nextMuted = !track.enabled;
    setMuted(nextMuted);
    socket.emit("voiceMute", { roomId, muted: nextMuted });
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !socket) return;

    const onVoiceJoin = async ({ from }) => {
      if (from === socket.id || !streamRef.current) return;
      const pc = ensurePeer(from);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice-signal", {
        roomId,
        to: from,
        data: { sdp: pc.localDescription },
      });
    };

    const onSignal = async ({ from, data }) => {
      if (!streamRef.current) return;
      const pc = ensurePeer(from);
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("voice-signal", {
              roomId,
              to: from,
              data: { sdp: pc.localDescription },
            });
          }
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

    socket.on("voice-join", onVoiceJoin);
    socket.on("voice-signal", onSignal);
    socket.on("userListUpdate", onUserList);
    return () => {
      socket.off("voice-join", onVoiceJoin);
      socket.off("voice-signal", onSignal);
      socket.off("userListUpdate", onUserList);
      [...peersRef.current.keys()].forEach(dropPeer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [roomId, ensurePeer, dropPeer]);

  return { muted, joined, error };
};

export default useVoice;
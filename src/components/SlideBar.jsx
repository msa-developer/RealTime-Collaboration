"use client";

import {
  Avatar,
  AvatarBadge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "../services/socket";
import useVoice from "../services/useVoice";
import { getRoomName, getUsername } from "../services/username";
import { CopyIcon, MenuIcon, CloseIcon, MicIcon, MicOffIcon } from "./icons";

const SlideBar = ({ data }) => {
  const nav = useRouter();
  const { id: roomId } = useParams();
  const [username, setUsername] = useState("Anonymous");
  const [roomName, setRoomName] = useState("");
  const [open, setOpen] = useState(false);
  const { muted, toggle, error, blocked } = useVoice(roomId);
  const toast = useToast();

  useEffect(() => {
    setUsername(getUsername());
    setRoomName(getRoomName());
  }, []);

  useEffect(() => {
    const onRoom = ({ name }) => setRoomName(name || getRoomName());
    socket.on("roomUpdate", onRoom);
    return () => socket.off("roomUpdate", onRoom);
  }, []);

  useEffect(() => {
    if (error) {
      toast({ title: error, status: "error", duration: 5000, isClosable: true });
    }
  }, [error, toast]);

  /* Browser blocked audio autoplay: a click anywhere grants it. Retry on the
     next interaction so the user is not stuck in silence. */
  useEffect(() => {
    if (!blocked) return;
    const resume = () => {
      document
        .querySelectorAll("audio")
        .forEach((el) => el.play().catch(() => {}));
    };
    document.addEventListener("click", resume, { once: true });
    toast({
      title: "Voice is muted by your browser",
      description: "Click anywhere once to allow audio playback.",
      status: "warning",
      duration: null,
      isClosable: true,
    });
    return () => document.removeEventListener("click", resume);
  }, [blocked, toast]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({ title: "Room ID copied", status: "success", duration: 2000 });
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId, username });
    nav.push("/");
  };

  return (
    <>
      {/* Mobile: collapsed bar with a button that opens the full slide bar */}
      <HStack
        display={{ base: "flex", md: "none" }}
        w="full"
        spacing="xs"
        px="md"
        py="xs"
        bg="canvas"
        borderBottom="1px solid"
        borderColor="hairline"
        flexShrink={0}
      >
        <IconButton
          aria-label="Open slide bar"
          title="Open slide bar"
          icon={<MenuIcon />}
          onClick={() => setOpen(true)}
          size="sm"
          variant="ghost"
          color="ink"
          _hover={{ bg: "hairlineSoft" }}
        />
        <HStack spacing={-1}>
          {data.slice(0, 4).map((user) => (
            <Avatar
              key={user.socketId}
              name={user.username}
              size="xs"
              border="2px solid"
              borderColor="canvas"
            />
          ))}
        </HStack>
        <Text
          as="span"
          fontFamily="mono"
          fontSize="12px"
          color="ink"
          bg="hairlineSoft"
          border="1px solid"
          borderColor="hairline"
          rounded="pill"
          px="xs"
        >
          {data.length}
        </Text>
        <IconButton
          aria-label="Copy room ID"
          title="Copy room ID"
          icon={<CopyIcon />}
          onClick={copyRoomId}
          size="sm"
          variant="ghostSm"
        />
        <Button variant="dangerSm" size="sm" onClick={leaveRoom}>
          Leave
        </Button>
      </HStack>

      <Box
        as="aside"
        w={{ base: "full", md: "280px" }}
        flexShrink={0}
        bg="canvas"
        borderRight="1px solid"
        borderColor="hairline"
        px={{ base: "md", md: "lg" }}
        py={{ base: "md", md: "lg" }}
        display={{ base: open ? "flex" : "none", md: "flex" }}
        flexDirection="column"
        gap="md"
        maxH="100dvh"
        overflowY="auto"
        position={{ base: open ? "fixed" : "relative", md: "relative" }}
        inset={{ base: open ? 0 : "auto", md: "auto" }}
        zIndex={20}
      >
      {/* Room identity — close button collapses the slide bar on mobile */}
      <Box minW={0}>
        <HStack justify="space-between" align="center" mb="xs">
          <Text as="p" textStyle="monoEyebrow" color="mute">
            Room
          </Text>
          <IconButton
            aria-label="Close slide bar"
            title="Close slide bar"
            icon={<CloseIcon />}
            onClick={() => setOpen(false)}
            size="sm"
            variant="ghost"
            color="ink"
            display={{ base: "flex", md: "none" }}
            _hover={{ bg: "hairlineSoft" }}
          />
        </HStack>
        <Text
          as="p"
          textStyle="labelSm"
          fontWeight="600"
          color="ink"
          noOfLines={1}
        >
          {roomName || "Untitled room"}
        </Text>
        <Button
          variant="ghostSm"
          size="sm"
          w="full"
          mt="sm"
          leftIcon={<CopyIcon />}
          onClick={copyRoomId}
        >
          Copy room ID
        </Button>
      </Box>

      {/* Connected users */}
      <Flex
        direction="column"
        minH="0"
        flex="1"
      >
        <HStack justify="space-between" mb="xs">
          <Text as="p" textStyle="monoEyebrow" color="mute">
            Connected
          </Text>
          <Text
            as="span"
            fontFamily="mono"
            fontSize="12px"
            color="ink"
            bg="hairlineSoft"
            border="1px solid"
            borderColor="hairline"
            rounded="pill"
            px="xs"
          >
            {data.length}
          </Text>
        </HStack>
        <VStack
          w="full"
          flex="1"
          overflowY="auto"
          align="stretch"
          spacing="xs"
          minH="0"
        >
          {data.length === 0 ? (
            <Text as="p" textStyle="bodySm" color="faint">
              You are alone in this room. Share the ID to invite others.
            </Text>
          ) : (
            data.map((user) => {
              const isSelf = user.socketId === socket.id;
              const isMuted = isSelf ? muted : user.muted !== false;
              return (
                <HStack
                  key={user.socketId}
                  spacing="sm"
                  p="xs"
                  rounded="sm"
                  border="1px solid"
                  borderColor="hairline"
                  bg="elevated"
                >
                  <Avatar name={user.username} size="xs">
                    <AvatarBadge boxSize="0.6em" bg="#0070f3" />
                  </Avatar>
                  <Text
                    as="span"
                    textStyle="labelSm"
                    color="ink"
                    noOfLines={1}
                    flex="1"
                  >
                    {user.username}
                    {isSelf ? (
                      <Text as="span" color="mute" fontWeight="400">
                        {" "}
                        (you)
                      </Text>
                    ) : null}
                  </Text>
                  {isSelf ? (
                    <IconButton
                      aria-label={
                        muted ? "Unmute microphone" : "Mute microphone"
                      }
                      title={muted ? "Unmute microphone" : "Mute microphone"}
                      icon={muted ? <MicOffIcon /> : <MicIcon />}
                      onClick={toggle}
                      size="sm"
                      variant="ghost"
                      h="24px"
                      w="24px"
                      minW="24px"
                      color={muted ? "faint" : "link"}
                      borderRadius="sm"
                      _hover={{ bg: "hairlineSoft" }}
                    />
                  ) : (
                    <Icon
                      as={isMuted ? MicOffIcon : MicIcon}
                      color={isMuted ? "faint" : "link"}
                      aria-label={isMuted ? "Muted" : "Unmuted"}
                    />
                  )}
                </HStack>
              );
            })
          )}
        </VStack>
      </Flex>

      <Button variant="dangerSm" w="full" mt="md" onClick={leaveRoom}>
        Leave room
      </Button>
      </Box>
    </>
  );
};

export default SlideBar;
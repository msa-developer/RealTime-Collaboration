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
import { CopyIcon, MicIcon, MicOffIcon } from "./icons";

const SlideBar = ({ data }) => {
  const nav = useRouter();
  const { id: roomId } = useParams();
  const [username, setUsername] = useState("Anonymous");
  const [roomName, setRoomName] = useState("");
  const { muted, toggle, error } = useVoice(roomId);
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

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({ title: "Room ID copied", status: "success", duration: 2000 });
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId, username });
    nav.push("/");
  };

  return (
    <Box
      as="aside"
      w={{ base: "full", md: "280px" }}
      flexShrink={0}
      bg="canvas"
      borderRight={{ base: "none", md: "1px solid" }}
      borderBottom={{ base: "1px solid", md: "none" }}
      borderColor="hairline"
      px={{ base: "sm", md: "lg" }}
      py={{ base: "xs", md: "lg" }}
      display="flex"
      flexDirection={{ base: "row", md: "column" }}
      alignItems={{ base: "center", md: "stretch" }}
      gap={{ base: "sm", md: "md" }}
      maxH={{ base: "none", md: "100dvh" }}
    >
      {/* Room identity — eyebrow + copy button belong to the desktop column only */}
      <Box flex={{ base: 1, md: "none" }} minW={0}>
        <Text
          as="p"
          textStyle="monoEyebrow"
          color="mute"
          mb="xs"
          display={{ base: "none", md: "block" }}
        >
          Room
        </Text>
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
          display={{ base: "none", md: "flex" }}
        >
          Copy room ID
        </Button>
      </Box>

      {/* Connected users — desktop column */}
      <Flex
        direction="column"
        minH="0"
        flex="1"
        display={{ base: "none", md: "flex" }}
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

      {/* Mobile bar: presence + actions in one thumb-reach row */}
      <HStack spacing="xs" flexShrink={0} display={{ base: "flex", md: "none" }}>
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

      <Button
        variant="dangerSm"
        w="full"
        onClick={leaveRoom}
        display={{ base: "none", md: "flex" }}
      >
        Leave room
      </Button>
    </Box>
  );
};

export default SlideBar;
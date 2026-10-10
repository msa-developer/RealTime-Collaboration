"use client";

import {
  Avatar,
  AvatarBadge,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import socket from "../services/socket";
import { getUsername } from "../services/username";
import { CopyIcon } from "./icons";

const SlideBar = ({ data }) => {
  const nav = useRouter();
  const { id: roomId } = useParams();
  const [username, setUsername] = useState("Anonymous");
  const toast = useToast();

  useEffect(() => {
    setUsername(getUsername());
  }, []);

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
      px={{ base: "md", md: "lg" }}
      py={{ base: "sm", md: "lg" }}
      display="flex"
      flexDirection="column"
      gap="md"
      maxH={{ base: "none", md: "100dvh" }}
    >
      {/* Room identity */}
      <Box>
        <Text as="p" textStyle="monoEyebrow" color="mute" mb="xs">
          Room
        </Text>
        <HStack justify="space-between" spacing="xs">
          <Text
            as="span"
            fontFamily="mono"
            fontSize="13px"
            color="ink"
            noOfLines={1}
            title={roomId}
          >
            {roomId?.slice(0, 14)}…
          </Text>
        </HStack>
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
      <Flex direction="column" minH="0" flex="1">
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
            data.map((user) => (
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
                  {user.username === username ? (
                    <Text as="span" color="mute" fontWeight="400">
                      {" "}
                      (you)
                    </Text>
                  ) : null}
                </Text>
              </HStack>
            ))
          )}
        </VStack>
      </Flex>

      <Button variant="dangerSm" w="full" onClick={leaveRoom}>
        Leave room
      </Button>
    </Box>
  );
};

export default SlideBar;
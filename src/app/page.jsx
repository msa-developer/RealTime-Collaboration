"use client";

import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Link,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import socket from "../services/socket";
import { classifyRoom } from "../services/roomStatus";
import { newRoomId } from "../services/roomId";

const FEATURES = [
  {
    title: "Live sync",
    body: "Every keystroke propagates to the room over WebSocket. No refresh, no merge conflicts.",
  },
  {
    title: "Run it inline",
    body: "JavaScript, Python, Java, and C++ compile and run from the editor. Output lands in the console below.",
  },
  {
    title: "Nothing to install",
    body: "Create a room, share the ID, start typing. The whole toolchain lives in the browser.",
  },
];

const HomePage = () => {
  const toast = useToast();
  const [NewId, setNewId] = useState("");
  const [user, setUser] = useState("");
  const [roomName, setRoomName] = useState("");
  const nav = useRouter();
  const [roomInfo, setRoomInfo] = useState(null); // null = unknown/checking

  /* Ask the server whether this room ID exists (debounced while typing). */
  useEffect(() => {
    const id = NewId.trim();
    if (!id) {
      setRoomInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      socket.emit("checkRoom", { roomId: id }, (info) => setRoomInfo(info));
    }, 300);
    return () => clearTimeout(timer);
  }, [NewId]);

  const action = classifyRoom({ roomId: NewId, roomName, serverRoom: roomInfo });
  const nameWrong = action === "nameMismatch";

  const CreateId = (e) => {
    e?.preventDefault?.();
    setNewId(newRoomId());
  };

  const JoinNow = () => {
    if (!user.trim()) {
      toast({
        status: "error",
        description: "Enter your name so teammates can see you.",
        duration: 2000,
      });
      return;
    }
    if (action !== "join" && action !== "create") {
      toast({
        status: "error",
        description:
          action === "nameMismatch"
            ? "Room ID is in use with a different room name. Fix the name or create a new ID."
            : "Enter a room ID and room name first.",
        duration: 2500,
      });
      return;
    }
    sessionStorage.setItem("username", user.trim());
    sessionStorage.setItem("roomName", roomName.trim());
    nav.push(`/editor/${NewId.trim()}`);
  };

  const handleEnter = (e) => {
    if (e.code === "Enter") JoinNow();
  };

  const ready = (action === "join" || action === "create") && Boolean(user.trim());

  return (
    <Box bg="canvas" minH="100dvh">
      {/* Nav */}
      <Flex
        as="nav"
        position="sticky"
        top="0"
        zIndex="10"
        bg="canvas"
        borderBottom="1px solid"
        borderColor="hairline"
        px={{ base: "md", lg: "lg" }}
        py="sm"
        align="center"
        justify="space-between"
      >
        <HStack spacing="xs">
          <Text as="span" textStyle="labelSm" color="ink" fontWeight="600">
            Realtime
          </Text>
        </HStack>
        <HStack spacing="xs" display={{ base: "none", sm: "flex" }}>
          <Link href="#features" textStyle="bodySm" color="body" px="sm" py="xs" _hover={{ color: "ink" }}>
            Features
          </Link>
          <Link href="#start" textStyle="bodySm" color="body" px="sm" py="xs" _hover={{ color: "ink" }}>
            Start
          </Link>
        </HStack>
        <Button variant="primarySm" onClick={CreateId}>
          Create room
        </Button>
      </Flex>

      {/* Hero — mesh gradient is the only color on the page */}
      <Box
        id="start"
        position="relative"
        overflow="hidden"
        px="md"
        pt={{ base: "4xl", md: "section" }}
        pb={{ base: "4xl", md: "4xl" }}
      >
        <Box
          aria-hidden="true"
          position="absolute"
          inset="-10% -10% auto -10%"
          h="640px"
          animation="meshDrift 18s ease-in-out infinite"
          background="
            radial-gradient(38% 46% at 18% 32%, rgba(0,223,216,0.42), transparent 70%),
            radial-gradient(42% 50% at 42% 24%, rgba(0,124,240,0.34), transparent 70%),
            radial-gradient(40% 48% at 66% 36%, rgba(121,40,202,0.30), transparent 70%),
            radial-gradient(36% 44% at 84% 26%, rgba(255,0,128,0.24), transparent 70%),
            radial-gradient(34% 42% at 55% 58%, rgba(249,203,40,0.28), transparent 70%)"
          filter="blur(40px)"
          sx={{
            maskImage:
              "radial-gradient(120% 100% at 50% 20%, black 30%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 50% 20%, black 30%, transparent 100%)",
          }}
        />
        <VStack
          position="relative"
          spacing="lg"
          align="center"
          textAlign="center"
          maxW="820px"
          mx="auto"
          animation="fadeUp .5s ease-out both"
        >
          <Text as="h1" textStyle="displayXl" maxW="16ch">
            Write code together, in real time.
          </Text>
          <Text as="p" textStyle="bodyLg" maxW="60ch">
            Create a room, share the ID, and ship from one shared editor. Live
            sync, multi-language runs, zero setup.
          </Text>

          {/* Join panel */}
          <Box
            w={{ base: "100%", sm: "440px" }}
            bg="elevated"
            border="1px solid"
            borderColor="hairline"
            rounded="lg"
            p="lg"
            textAlign="left"
            boxShadow="0 2px 2px rgba(0,0,0,0.04), 0 8px 16px -4px rgba(0,0,0,0.08)"
          >
            <VStack spacing="sm">
              <Box w="full">
                <Text as="label" htmlFor="room-id" textStyle="monoEyebrow" color="mute" display="block" mb="xs">
                  Room ID
                </Text>
                <Input
                  id="room-id"
                  value={NewId}
                  type="text"
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="Paste an ID or create a new room"
                  autoComplete="off"
                />
              </Box>
              <Box w="full">
                <Text as="label" htmlFor="room-name" textStyle="monoEyebrow" color="mute" display="block" mb="xs">
                  Room name
                </Text>
                <Input
                  id="room-name"
                  value={roomName}
                  type="text"
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Sprint 12 pairing"
                  autoComplete="off"
                  isInvalid={nameWrong}
                  aria-invalid={nameWrong}
                  aria-describedby={nameWrong ? "room-name-error" : undefined}
                  borderColor={nameWrong ? "errorDeep" : undefined}
                  _hover={nameWrong ? { borderColor: "errorDeep" } : undefined}
                  _focus={
                    nameWrong
                      ? {
                          borderColor: "errorDeep",
                          boxShadow: "0 0 0 3px rgba(238,0,0,0.15)",
                          outline: "none",
                        }
                      : undefined
                  }
                />
                {nameWrong && (
                  <Text
                    id="room-name-error"
                    w="full"
                    fontSize="13px"
                    lineHeight="20px"
                    color="errorDeep"
                  >
                    Wrong room name for this Room ID. The ID already exists —
                    type the exact room name, or click New ID for a free one.
                  </Text>
                )}
              </Box>
              <Box w="full">
                <Text as="label" htmlFor="username" textStyle="monoEyebrow" color="mute" display="block" mb="xs">
                  Your name
                </Text>
                <Input
                  id="username"
                  value={user}
                  type="text"
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="How teammates see you"
                  onKeyUp={handleEnter}
                  autoComplete="off"
                />
              </Box>
              <Flex w="full" gap="sm" pt="xs">
                <Button variant="secondaryPill" flex="1" onClick={CreateId}>
                  {NewId ? "New ID" : "Create room"}
                </Button>
                <Button variant="primaryPill" flex="1" isDisabled={!ready} onClick={JoinNow}>
                  {action === "create" ? "Create room" : "Join room"}
                </Button>
              </Flex>
              {action === "join" && (
                <Text w="full" fontSize="13px" lineHeight="20px" color="mute">
                  Room found. Ready to join.
                </Text>
              )}
              {action === "create" && (
                <Text w="full" fontSize="13px" lineHeight="20px" color="mute">
                  New room. It will be created when you continue.
                </Text>
              )}
            </VStack>
          </Box>
        </VStack>
      </Box>


      {/* Features — hairline card grid */}
      <Box id="features" maxW="1200px" mx="auto" px="md" py={{ base: "3xl", md: "4xl" }}>
        <Text as="h2" textStyle="headingLg" maxW="20ch" mb="xl">
          An editor that behaves like a product, not a demo.
        </Text>
        <Flex gap="lg" direction={{ base: "column", md: "row" }}>
          {FEATURES.map((f) => (
            <Box
              key={f.title}
              flex="1"
              bg="elevated"
              border="1px solid"
              borderColor="hairline"
              rounded="md"
              p="lg"
              transition="border-color .15s ease"
              _hover={{ borderColor: "#d4d4d4" }}
            >
              <Text as="h3" textStyle="headingMd" mb="xs">
                {f.title}
              </Text>
              <Text as="p" textStyle="bodySm" fontSize="14px" lineHeight="22px">
                {f.body}
              </Text>
            </Box>
          ))}
        </Flex>
      </Box>

      {/* CTA band */}
      <Box borderTop="1px solid" borderColor="hairline" px="md" py={{ base: "3xl", md: "4xl" }}>
        <VStack spacing="md">
          <Text as="h2" textStyle="headingLg" textAlign="center">
            Start a room in one click.
          </Text>
          <Button variant="primaryPill" onClick={CreateId}>
            Create room
          </Button>
        </VStack>
      </Box>

      {/* Footer */}
      <Flex
        as="footer"
        borderTop="1px solid"
        borderColor="hairline"
        px={{ base: "md", lg: "lg" }}
        py="3xl"
        direction={{ base: "column", sm: "row" }}
        align="center"
        justify="space-between"
        gap="sm"
      >
        <HStack spacing="xs">
          <Text as="span" textStyle="labelSm" color="ink" fontWeight="600">
            Realtime
          </Text>
        </HStack>
        <Text as="span" textStyle="bodySm" color="mute">
          Built for pairs, teams, and interviews.
        </Text>
      </Flex>
    </Box>
  );
};

export default HomePage;


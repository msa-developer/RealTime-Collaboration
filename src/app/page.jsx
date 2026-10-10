"use client";

import { Box, Button, HStack, Input, useToast, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const HomePage = () => {
  const toast = useToast();

  const [NewId, setNewId] = useState("");

  const [user, setUser] = useState("");

  const CreateId = (e) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    setNewId(id);
  };

  const nav = useRouter();

  const JoinNow = () => {
    if (!NewId || !user) {
      toast({
        status: "error",
        description: "Please Fill All The Details",
        duration: 1000,
      });
      return;
    }
    sessionStorage.setItem("username", user);
    nav.push(`/editor/${NewId}`);
  };

  const handleEnter = (e) => {
    if (e.code === "Enter") {
      JoinNow();
    }
  };

  return (
    <VStack minH={"100dvh"} justify={"center"} align={"center"}>
      <Box
        p={6}
        maxW="sm"
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
      >
        <VStack spacing={6} p={"2.5"}>
          <Input
            value={NewId}
            type="text"
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Enter id"
            size="lg"
          />
          <Input
            onChange={(e) => setUser(e.target.value)}
            type="text"
            value={user}
            placeholder="Enter username.."
            onKeyUp={handleEnter}
            size="lg"
          />

          <HStack>
            {!NewId ? (
              <Button colorScheme="green" onClick={CreateId}>
                Create New Id
              </Button>
            ) : null}

            <Button colorScheme="blue" onClick={JoinNow}>
              Join Now
            </Button>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
};

export default HomePage;

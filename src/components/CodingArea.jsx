"use client";

import { Box, Button, Flex, HStack, Select, Text, useToast } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import socket from "../services/socket";
import { getRoomName, getUsername } from "../services/username";
import { ArrowLeftIcon, PlayIcon } from "./icons";

/* Monaco touches window — never render it on the server */
const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false },
);

const LANGUAGES = [
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" },
  { id: "java", label: "Java", monaco: "java" },
  { id: "cpp", label: "C++", monaco: "cpp" },
];

/* Monaco ships rich IntelliSense only for JS/TS/JSON/CSS/HTML.
   Python/Java/C++ get colorization only — these providers fill the gap. */
const COMPLETIONS = {
  python: {
    keywords: [
      "def", "class", "if", "elif", "else", "for", "while", "return",
      "import", "from", "as", "with", "try", "except", "finally", "raise",
      "pass", "break", "continue", "lambda", "in", "is", "and", "or", "not",
      "True", "False", "None", "self", "global", "yield", "assert", "del",
      "print", "input", "range", "len", "str", "int", "float", "list",
      "dict", "set", "tuple", "open",
    ],
    snippets: [
      ["def", "def ${1:name}(${2:args}):\n\t${0}"],
      ["class", "class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t${0}"],
      ["for", "for ${1:item} in ${2:iterable}:\n\t${0}"],
      ["while", "while ${1:condition}:\n\t${0}"],
      ["ifmain", 'if __name__ == "__main__":\n\t${0}'],
      ["try", "try:\n\t${1}\nexcept ${2:Exception} as e:\n\t${0}"],
      ["main", 'print(${1})${0}'],
    ],
  },
  java: {
    keywords: [
      "public", "private", "protected", "static", "void", "class",
      "interface", "extends", "implements", "new", "return", "if", "else",
      "for", "while", "do", "switch", "case", "break", "continue", "try",
      "catch", "finally", "throw", "throws", "this", "super", "import",
      "package", "int", "double", "float", "boolean", "char", "String",
      "long", "short", "byte", "abstract", "final", "enum", "instanceof",
      "null", "true", "false", "System.out.println",
    ],
    snippets: [
      ["main", "public static void main(String[] args) {\n\t${0}\n}"],
      ["class", "public class ${1:Name} {\n\t${0}\n}"],
      ["for", "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${0}\n}"],
      ["if", "if (${1:condition}) {\n\t${0}\n}"],
      ["sout", "System.out.println(${1});${0}"],
      ["psvm", "public static void main(String[] args) {\n\t${0}\n}"],
    ],
  },
  cpp: {
    keywords: [
      "#include <iostream>", "using namespace std;", "int", "double",
      "float", "char", "bool", "void", "long", "auto", "const", "class",
      "struct", "public", "private", "protected", "template", "typename",
      "return", "if", "else", "for", "while", "do", "switch", "case",
      "break", "continue", "try", "catch", "throw", "new", "delete",
      "nullptr", "true", "false", "std::", "vector", "string", "cout",
      "cin", "endl", "printf", "size_t",
    ],
    snippets: [
      ["main", "#include <iostream>\n\nint main() {\n\t${0}\n\treturn 0;\n}"],
      ["for", "for (${1:int i = 0}; ${1:i} < ${2:n}; ${1:i}++) {\n\t${0}\n}"],
      ["while", "while (${1:condition}) {\n\t${0}\n}"],
      ["cout", "cout << ${1} << endl;${0}"],
      ["cin", "cin >> ${1};${0}"],
      ["vec", "std::vector<${1:int}> ${2:v};${0}"],
    ],
  },
};

const CodingArea = ({ setUsers }) => {
  const [codeValue, setCodeValue] = useState("");
  const EditorRef = useRef();
  const { id: roomId } = useParams();
  const [username, setUsername] = useState("Anonymous");
  const toast = useToast();
  const nav = useRouter();
  const typingTimeoutRef = useRef(null);
  const [typingToastId, setTypingToastId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentlyTypingUser, setCurrentlyTypingUser] = useState(null);
  const [language, setLanguage] = useState("javascript");
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [output, setOutput] = useState(null);
  const [runBy, setRunBy] = useState("");

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  useEffect(() => {
    /* Read name now — state ("Anonymous") not settled yet on mount,
       and server keeps the first username it sees per socket. */
    socket.emit("joinRoom", {
      roomId,
      username: getUsername(),
      roomName: getRoomName(),
    });

    socket.on("codeUpdate", (code) => {
      setCodeValue(code);
    });

    socket.on("runUpdate", ({ running, output, by }) => {
      setRunning(Boolean(running));
      setOutput(output || null);
      setRunBy(by || "");
    });

    socket.on("userListUpdate", (users) => {
      setUsers(users);
    });

    socket.on("userJoined", (joinedUsername) => {
      toast({
        title: `${joinedUsername} joined the room`,
        status: "info",
        duration: 3000,
      });
    });

    socket.on("userLeft", (leftUsername) => {
      toast({
        title: `${leftUsername} left the room`,
        status: "warning",
        duration: 3000,
      });
    });

    socket.on("userTyping", (typingUsername) => {
      if (!currentlyTypingUser || currentlyTypingUser !== typingUsername) {
        if (typingToastId) {
          toast.close(typingToastId);
        }

        const toastId = toast({
          title: `${typingUsername} typing...`,
          status: "info",
          duration: null,
          isClosable: false,
        });
        setTypingToastId(toastId);
        setCurrentlyTypingUser(typingUsername);
      }
    });

    socket.on("userStoppedTyping", (typingUsername) => {
      if (typingToastId && currentlyTypingUser === typingUsername) {
        toast.close(typingToastId);
        setTypingToastId(null);
        setCurrentlyTypingUser(null);
      }
    });

    return () => {
      socket.off("codeUpdate");
      socket.off("runUpdate");
      socket.off("userListUpdate");
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("userTyping");
      socket.off("userStoppedTyping");

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, username, setUsers, toast, typingToastId, currentlyTypingUser]);

  const handleCodeChange = (code) => {
    setCodeValue(code);
    socket.emit("codeChange", { roomId, code });

    if (!isTyping) {
      socket.emit("userTyping", { roomId, username });
      setIsTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("userStoppedTyping", { roomId, username });
      setIsTyping(false);
    }, 500);
  };

  const runCode = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setOutput(null);
    setRunBy("");
    socket.emit("runUpdate", { roomId, running: true, output: null });
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code: codeValue }),
      });
      const data = await res.json();
      socket.emit("runUpdate", {
        roomId,
        running: false,
        output: res.ok
          ? data
          : { stdout: "", stderr: data.error || "Run failed.", code: 1 },
      });
    } catch {
      socket.emit("runUpdate", {
        roomId,
        running: false,
        output: {
          stdout: "",
          stderr: "Cannot reach the run service. Is the backend running?",
          code: 1,
        },
      });
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };
  const runRef = useRef(runCode);
  runRef.current = runCode;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const OnMount = (editor, monaco) => {
    EditorRef.current = editor;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => runRef.current(),
    );

    Object.entries(COMPLETIONS).forEach(([lang, { keywords, snippets }]) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        triggerCharacters: [".", "_", ":", ">", "#"],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          );
          return {
            suggestions: [
              ...keywords.map((k) => ({
                label: k,
                kind: monaco.languages.CompletionItemKind.Keyword,
                range,
                insertText: k,
              })),
              ...snippets.map(([label, insertText]) => ({
                label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                range,
                insertText,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              })),
            ],
          };
        },
      });
    });

    /* Geist code theme — white surface, ink foreground, accent syntax */
    monaco.editor.defineTheme("geist", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "7928ca" },
        { token: "string", foreground: "0070f3" },
        { token: "comment", foreground: "8f8f8f" },
        { token: "number", foreground: "eb367f" },
        { token: "type", foreground: "171717" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#171717",
        "editor.lineHighlightBackground": "#fafafa",
        "editorLineNumber.foreground": "#a1a1a1",
        "editorLineNumber.activeForeground": "#171717",
        "editorCursor.foreground": "#171717",
        "editor.selectionBackground": "#d3e5ff",
        "editor.inactiveSelectionBackground": "#d3e5ff",
      },
    });
    monaco.editor.setTheme("geist");

    editor.focus();
  };

  return (
    <Box
      flex={{ base: "none", md: 1 }}
      minW="0"
      bg="canvas"
      display="flex"
      flexDirection="column"
      minH="0"
    >
      {/* App chrome bar */}
      <Flex
        align="center"
        justify="space-between"
        gap="sm"
        px={{ base: "md", lg: "lg" }}
        py="md"
        bg="elevated"
        borderBottom="1px solid"
        borderColor="hairline"
      >
        <HStack spacing="sm" minW="0">
          <Box
            as="button"
            onClick={() => nav.push("/")}
            title="Back to home"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="32px"
            h="32px"
            rounded="sm"
            border="1px solid"
            borderColor="hairline"
            bg="elevated"
            color="ink"
            cursor="pointer"
            _hover={{ borderColor: "#d4d4d4" }}
            flexShrink={0}
          >
            <ArrowLeftIcon />
          </Box>
          <Text as="p" textStyle="monoEyebrow" color="mute" whiteSpace="nowrap">
            Live Editor
          </Text>
          <Text
            as="span"
            fontFamily="mono"
            fontSize="13px"
            color="body"
            noOfLines={1}
            display={{ base: "none", sm: "inline" }}
          >
            {roomId.slice(0, 12)}…
          </Text>
        </HStack>

        {currentlyTypingUser ? (
          <HStack spacing="xs" flexShrink={0}>
            <Box className="pulse-dot" w="2" h="2" rounded="full" bg="link" />
            <Text as="p" textStyle="bodySm" color="body" whiteSpace="nowrap">
              {currentlyTypingUser} typing…
            </Text>
          </HStack>
        ) : (
          <HStack spacing="xs" flexShrink={0}>
            <Box w="2" h="2" rounded="full" bg="link" />
            <Text as="p" textStyle="bodySm" color="faint" whiteSpace="nowrap">
              Synced
            </Text>
          </HStack>
        )}
      </Flex>

      {/* Editor card — toolbar, code surface, output console */}
      <Box
        flex={{ base: "none", md: 1 }}
        p={{ base: "md", lg: "lg" }}
        minH="0"
        display="flex"
      >
        <Box
          flex={{ base: "none", md: 1 }}
          w="full"
          minW="0"
          minH="0"
          bg="elevated"
          border="1px solid"
          borderColor="hairline"
          rounded="md"
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          {/* Toolbar — language picker + Run */}
          <Flex
            align="center"
            justify="space-between"
            gap="sm"
            px="md"
            py="xs"
            borderBottom="1px solid"
            borderColor="hairline"
            flexShrink={0}
          >
            <HStack spacing="sm" minW="0">
              <Select
                aria-label="Programming language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                size="sm"
                w="auto"
                fontFamily="mono"
                fontSize="13px"
                bg="elevated"
                color="ink"
                border="1px solid"
                borderColor="hairline"
                rounded="sm"
                _hover={{ borderColor: "#d4d4d4" }}
                _focus={{ borderColor: "link", boxShadow: "0 0 0 3px #d3e5ff", outline: "none" }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
              <Text
                as="p"
                textStyle="monoEyebrow"
                color="faint"
                display={{ base: "none", md: "block" }}
              >
                Ctrl + Enter to run
              </Text>
            </HStack>
            <Button
              variant="primarySm"
              size="sm"
              leftIcon={<PlayIcon />}
              isLoading={running}
              onClick={runCode}
            >
              Run
            </Button>
          </Flex>

          {/* Code surface — fixed slice of viewport on mobile so the page
              can scroll; flex-fill inside the desktop app shell */}
          <Box
            flex={{ base: "none", md: 1 }}
            h={{ base: "50dvh", md: "auto" }}
            minH="0"
          >
            <Editor
              height="100%"
              theme="geist"
              value={codeValue}
              onChange={handleCodeChange}
              language={LANGUAGES.find((l) => l.id === language)?.monaco}
              onMount={OnMount}
              options={{
                minimap: { enabled: false },
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                renderLineHighlight: "line",
                automaticLayout: true,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                tabSize: 2,
              }}
            />
          </Box>

          {/* Output console */}
          <Box
            flexShrink={0}
            h={{ base: "130px", md: "200px" }}
            bg="canvas"
            borderTop="1px solid"
            borderColor="hairline"
            display="flex"
            flexDirection="column"
            minH="0"
          >
            <Flex
              align="center"
              justify="space-between"
              px="md"
              py="xxs"
              borderBottom="1px solid"
              borderColor="hairline"
              flexShrink={0}
            >
              <HStack spacing="xxs">
                <Text as="p" textStyle="monoEyebrow" color="mute">
                  Output
                </Text>
                {runBy && (
                  <Text as="p" textStyle="monoEyebrow" color="faint">
                    · {runBy}
                  </Text>
                )}
              </HStack>
              <Text
                as="p"
                textStyle="monoEyebrow"
                color={
                  running
                    ? "link"
                    : output?.timedOut
                      ? "warningDeep"
                      : output
                        ? output.code === 0
                          ? "link"
                          : "error"
                        : "faint"
                }
              >
                {running
                  ? "Running…"
                  : output?.timedOut
                    ? "Time limit"
                    : output
                      ? `Exit ${output.code}`
                      : "Idle"}
              </Text>
            </Flex>
            <Box flex="1" overflowY="auto" minH="0" px="md" py="sm">
              {output || running ? (
                <Box
                  as="pre"
                  textStyle="code"
                  fontSize="13px"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  m="0"
                >
                  {output?.stdout}
                  {output?.stderr && (
                    <Box as="span" color="error" display="block">
                      {output.stderr}
                    </Box>
                  )}
                </Box>
              ) : (
                <Text as="p" textStyle="code" fontSize="13px" color="faint">
                  Output appears here. Press Ctrl + Enter to run.
                </Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CodingArea;

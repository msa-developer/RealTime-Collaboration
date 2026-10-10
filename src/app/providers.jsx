"use client";

import { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme";

export default function Providers({ children }) {
  const [cache] = useState(() => createCache({ key: "chakra", prepend: true }));

  useServerInsertedHTML(() => {
    let css = "";
    const ids = [];
    for (const id in cache.inserted) {
      ids.push(id);
      if (typeof cache.inserted[id] === "string") css += cache.inserted[id];
    }
    if (!css) return;
    return (
      <style
        data-emotion={`${cache.key} ${ids.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: css }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ChakraProvider theme={theme}>{children}</ChakraProvider>
    </CacheProvider>
  );
}

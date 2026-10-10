"use client";

import { Flex } from "@chakra-ui/react";
import { useState } from "react";
import SlideBar from "../../../components/SlideBar";
import CodingArea from "../../../components/CodingArea";

const Collaborate = () => {
  const [data, setData] = useState([]);

  return (
    <Flex minH={"100dvh"}>
      <SlideBar data={data} />
      <CodingArea setUsers={setData} />
    </Flex>
  );
};

export default Collaborate;

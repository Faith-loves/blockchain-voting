import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.connect();

  const names = [
    "President",
    "Vice President",
    "Secretary",
    "Treasurer",
    "PRO",
    "Welfare Director",
    "Sports Director",
    "Social Director",
    "Academic Director",
    "General Rep"
  ];

  const Voting = await ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(names);

  await voting.waitForDeployment();

  console.log("Voting deployed to:", await voting.getAddress());
}

main().catch(console.error);
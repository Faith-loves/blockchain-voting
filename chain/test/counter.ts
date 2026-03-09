import { expect } from "chai";
import { ethers } from "hardhat";

describe("Counter", function () {
  it("starts at 0", async () => {
    const Counter = await ethers.getContractFactory("Counter");
    const c = await Counter.deploy();
    await c.waitForDeployment();
    expect(await c.count()).to.equal(0n);
  });

  it("inc works", async () => {
    const Counter = await ethers.getContractFactory("Counter");
    const c = await Counter.deploy();
    await c.waitForDeployment();

    await c.inc();
    expect(await c.count()).to.equal(1n);
  });
});
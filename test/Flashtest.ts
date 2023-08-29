import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { abi as abiFlashLoan } from "../artifacts/contracts/FlashLoan.sol/FlashLoan.json";

const WHALE_ADDR_BUSD = "0x28C6c06298d514Db089934071355E5743bf21d60";

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const BORROW_TOKEN = BUSD;

describe("BinanceFlashloanPancakeSwapV3", function () {
  async function create_whale() {
    const provider = ethers.provider;
    const whaleBalance = await provider.getBalance(WHALE_ADDR_BUSD);
    expect(whaleBalance).not.equal("0");

    // Impersonate Whale Account
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ADDR_BUSD],
    });
    const whaleWallet = ethers.provider.getSigner(WHALE_ADDR_BUSD);
    expect(await whaleWallet.getBalance()).not.equal("0");

    // Ensure BUSD Balance
    const abi = [
      "function balanceOf(address _owner) view returns (uint256 balance)",
    ];
    const contractBusd = new ethers.Contract(BORROW_TOKEN, abi, provider);
    const balanceBusd = await contractBusd.balanceOf(WHALE_ADDR_BUSD);
    expect(balanceBusd).not.equal("0");

    // Return output
    return { whaleWallet };
  }

  describe("Deployment and Testing", function () {
    it("Deploys and performs Flash Loan arbitrage", async function () {
      let { whaleWallet } = await loadFixture(create_whale);

      // // Deploys
      // const FlashLoan = await ethers.getContractFactory("FlashLoan");
      // let flashloan = await FlashLoan.deploy(WBNB, BUSD, 500);
      // await flashloan.deployed();
      // console.log("FlashLoan Contract Deployed: \t", flashloan.address);

      const realAddress = "0x0eBB090dE6F411d430b7489AF161dBc4C4824d9A";

      // Send BUSD for Fake Arbitrage Calculation (Smart Contract Should then Work)
      const usdAmt = ethers.utils.parseUnits("10", 18);
      const abi = [
        "function transfer(address _to, uint256 _value) public returns (bool success)",
        "function balanceOf(address _owner) view returns (uint256 balance)",
      ];
      const contractBusd = new ethers.Contract(BORROW_TOKEN, abi, whaleWallet);
      const txTferBUsd = await contractBusd.transfer(realAddress, usdAmt);
      const receiptTxBusd = await txTferBUsd.wait();
      expect(receiptTxBusd.status).to.eql(1);

      const contractBalBusd = await contractBusd.balanceOf(realAddress);
      console.log("Wallet BUSD Before: \t\t", contractBalBusd);

      // Initialize Flash Loan Params
      const amountBorrow = ethers.utils.parseUnits("30", 18);
      const tokenPath = [CAKE, WBNB];
      const routing = [1, 0, 0];
      const feeV3 = 500;

      // // Create a signer
      // const [signer] = await ethers.getSigners();

      // Connect to Flashloan Contract
      const contractFlashLoan = new ethers.Contract(
        realAddress,
        abiFlashLoan,
        whaleWallet
      );

      // Call Flashloan Request Function
      const txFlashloan = await contractFlashLoan.flashloanRequest(
        tokenPath,
        0,
        amountBorrow,
        feeV3,
        routing
      );

      // Show Results
      const txFlashloanReceipt = await txFlashloan.wait();
      expect(txFlashloanReceipt.status).to.eql(1);

      const contractBalBusdAfter = await contractBusd.balanceOf(realAddress);
      console.log("Wallet BUSD After: \t\t", contractBalBusdAfter);
    });
  });
});

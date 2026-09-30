import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Marketplace", function () {
  async function deployFixture() {
    const [seller, buyer, other] = await ethers.getSigners();
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy();
    return { marketplace, seller, buyer, other };
  }

  const PRICE = ethers.parseEther("0.01");

  it("lists an asset and emits AssetListed", async function () {
    const { marketplace, seller } = await deployFixture();
    await expect(marketplace.connect(seller).listAsset(1, PRICE))
      .to.emit(marketplace, "AssetListed")
      .withArgs(1, seller.address, PRICE);
    expect(await marketplace.assetSeller(1)).to.equal(seller.address);
    expect(await marketplace.assetPrice(1)).to.equal(PRICE);
  });

  it("reverts listing assetId 0", async function () {
    const { marketplace, seller } = await deployFixture();
    await expect(
      marketplace.connect(seller).listAsset(0, PRICE)
    ).to.be.revertedWith("assetId 0 is reserved");
  });

  it("reverts listing the same assetId twice", async function () {
    const { marketplace, seller, other } = await deployFixture();
    await marketplace.connect(seller).listAsset(1, PRICE);
    await expect(
      marketplace.connect(other).listAsset(1, PRICE)
    ).to.be.revertedWith("Already listed");
  });

  it("reverts listing with price 0", async function () {
    const { marketplace, seller } = await deployFixture();
    await expect(marketplace.connect(seller).listAsset(1, 0)).to.be.revertedWith(
      "Price must be > 0"
    );
  });

  it("reverts purchase when value is under the listed price", async function () {
    const { marketplace, seller, buyer } = await deployFixture();
    await marketplace.connect(seller).listAsset(1, PRICE);
    await expect(
      marketplace.connect(buyer).purchase(1, { value: PRICE - 1n })
    ).to.be.revertedWith("Incorrect payment amount");
  });

  it("reverts purchase when value is over the listed price", async function () {
    const { marketplace, seller, buyer } = await deployFixture();
    await marketplace.connect(seller).listAsset(1, PRICE);
    await expect(
      marketplace.connect(buyer).purchase(1, { value: PRICE + 1n })
    ).to.be.revertedWith("Incorrect payment amount");
  });

  it("transfers funds to the seller and emits Purchased on exact payment", async function () {
    const { marketplace, seller, buyer } = await deployFixture();
    await marketplace.connect(seller).listAsset(7, PRICE);
    await expect(marketplace.connect(buyer).purchase(7, { value: PRICE }))
      .to.emit(marketplace, "Purchased")
      .withArgs(7, buyer.address, seller.address, PRICE, anyValue);
    expect(await marketplace.hasPurchased(7, buyer.address)).to.equal(true);

    await marketplace.connect(seller).listAsset(8, PRICE);
    await expect(marketplace.connect(buyer).purchase(8, { value: PRICE }))
      .to.changeEtherBalance(seller, PRICE);
  });

  it("reverts if the same buyer purchases the same asset twice", async function () {
    const { marketplace, seller, buyer } = await deployFixture();
    await marketplace.connect(seller).listAsset(1, PRICE);
    await marketplace.connect(buyer).purchase(1, { value: PRICE });
    await expect(
      marketplace.connect(buyer).purchase(1, { value: PRICE })
    ).to.be.revertedWith("Already purchased");
  });

  it("reverts when purchasing an assetId that was never listed", async function () {
    const { marketplace, buyer } = await deployFixture();
    await expect(
      marketplace.connect(buyer).purchase(999, { value: PRICE })
    ).to.be.revertedWith("Not listed");
  });
});

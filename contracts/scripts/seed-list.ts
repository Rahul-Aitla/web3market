import { ethers } from "hardhat";
import path from "node:path";
import fs from "node:fs";

// Lists the seed assets on-chain from the deployer wallet. The deployer
// must be the same address as SEED_SELLER_ADDRESS used by prisma/seed.ts.
// Usage: npx hardhat run scripts/seed-list.ts --network sepolia -- <MARKETPLACE_ADDRESS>
// (or set MARKETPLACE_ADDRESS in contracts/.env)
async function main() {
  const address = process.argv[2] ?? process.env.MARKETPLACE_ADDRESS;
  if (!address) {
    throw new Error(
      "Pass the contract address as argv or set MARKETPLACE_ADDRESS"
    );
  }

  const file = path.resolve(__dirname, "../../seed/seed-assets.json");
  const items = JSON.parse(fs.readFileSync(file, "utf8")) as {
    onChainId: number;
    priceWei: string;
  }[];

  const marketplace = await ethers.getContractAt("Marketplace", address);
  for (const item of items) {
    const seller = await marketplace.assetSeller(item.onChainId);
    if (seller !== ethers.ZeroAddress) {
      console.log(`skip onChainId=${item.onChainId} (already listed by ${seller})`);
      continue;
    }
    const tx = await marketplace.listAsset(item.onChainId, item.priceWei);
    await tx.wait();
    console.log(`listed onChainId=${item.onChainId} price=${item.priceWei} wei`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

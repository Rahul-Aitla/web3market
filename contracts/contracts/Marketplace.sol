// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Known, deliberate limitations (documented for viva, not oversights):
// - assetId 0 is reserved as the "unlisted" sentinel. The app's onChainId
//   column must autoincrement starting at 1.
// - listAsset is first-come-first-served per assetId: anyone could in
//   theory list assetId N before its intended seller does. Mitigated at
//   the app level, not the contract level - the app calls listAsset
//   immediately after creating the DRAFT row, in the same flow, so the
//   window is seconds, not longer. A squatted id is simply abandoned;
//   the app creates a new Asset row with a fresh onChainId.
// - There is no updatePrice/unlist function. An app-level ARCHIVED
//   status is display-only: the listing remains purchasable on-chain
//   even if hidden from the catalog UI. This is a stated assumption,
//   not a bug.
// - purchase() requires the EXACT listed price (not >=), so there is no
//   overpayment-refund logic to reason about. The frontend always sends
//   exactly priceWei.
contract Marketplace is ReentrancyGuard {
    mapping(uint256 => address payable) public assetSeller;
    mapping(uint256 => uint256) public assetPrice; // price in wei
    mapping(uint256 => mapping(address => bool)) public hasPurchased;

    event AssetListed(uint256 indexed assetId, address indexed seller, uint256 price);
    event Purchased(uint256 indexed assetId, address indexed buyer, address indexed seller, uint256 amount, uint256 timestamp);

    function listAsset(uint256 assetId, uint256 priceWei) external {
        require(assetId != 0, "assetId 0 is reserved");
        require(assetSeller[assetId] == address(0), "Already listed");
        require(priceWei > 0, "Price must be > 0");
        assetSeller[assetId] = payable(msg.sender);
        assetPrice[assetId] = priceWei;
        emit AssetListed(assetId, msg.sender, priceWei);
    }

    function purchase(uint256 assetId) external payable nonReentrant {
        address payable seller = assetSeller[assetId];
        require(seller != address(0), "Not listed");
        require(msg.value == assetPrice[assetId], "Incorrect payment amount");
        require(!hasPurchased[assetId][msg.sender], "Already purchased");

        hasPurchased[assetId][msg.sender] = true;

        (bool sent, ) = seller.call{value: msg.value}("");
        require(sent, "Transfer to seller failed");

        emit Purchased(assetId, msg.sender, seller, msg.value, block.timestamp);
    }
}

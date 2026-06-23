// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract hottoDog is ERC20, ERC20Permit {
    address public owner;

    constructor() ERC20("hottoDog", "hotDog") ERC20Permit("hottoDog") {
        owner = msg.sender;
    }

    function mintToFactory(address factoryAddress) external {
        require(msg.sender == owner, "Only owner can mint");
        require(factoryAddress != address(0), "Factory required");
        _mint(factoryAddress, 50_000_000 * 10 ** 18);
    }
}
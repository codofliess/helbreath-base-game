// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HelbreathRH} from "../src/HelbreathRH.sol";

contract Wallet {
    function pull(HelbreathRH token, address to, uint256 amount) external {
        require(token.transfer(to, amount), "xfer");
    }
}

contract HelbreathRHTest {
    HelbreathRH internal token;
    Wallet internal alice;
    Wallet internal bob;

    function setUp() public {
        token = new HelbreathRH(address(this));
        alice = new Wallet();
        bob = new Wallet();
    }

    function testMintAllToTreasury() public view {
        require(token.balanceOf(address(this)) == 1_000_000_000 ether, "not 1B at treasury");
        require(keccak256(bytes(token.symbol())) == keccak256(bytes("HELBREATH")), "ticker");
        require(token.taxBps() == 500, "default tax");
    }

    function testTreasuryToWalletNoTax() public {
        token.transfer(address(alice), 1_000 ether);
        require(token.balanceOf(address(alice)) == 1_000 ether, "seed taxed");
    }

    function testPeerTransferPaysTreasury() public {
        token.transfer(address(alice), 1_000 ether);
        alice.pull(token, address(bob), 100 ether);
        uint256 fee = (100 ether * 500) / 10_000;
        require(token.balanceOf(address(bob)) == 100 ether - fee, "bob");
        require(token.balanceOf(address(this)) == 1_000_000_000 ether - 1_000 ether + fee, "fee sink");
    }

    function testPairExcludedNoTax() public {
        token.transfer(address(alice), 1_000 ether);
        token.setDexPair(address(bob));
        alice.pull(token, address(bob), 100 ether);
        require(token.balanceOf(address(bob)) == 100 ether, "pair taxed");
    }

    function testTaxCap() public {
        token.setTaxBps(1_000);
        require(token.taxBps() == 1_000, "cap set");
        try token.setTaxBps(1_001) {
            revert("cap");
        } catch {}
    }
}

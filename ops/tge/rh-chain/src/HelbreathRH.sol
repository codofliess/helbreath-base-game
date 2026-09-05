// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HELBREATH on Robinhood Chain
/// @notice Fixed 1B ERC-20. 100% minted to treasury at deploy.
///         Transfer tax (default 5%, hard-capped 10%) goes to treasury.
///         Not a honeypot: no blacklist, no sell block, no hidden max-tx.
///         Pair must be tax-excluded after it is created or LP adds break.
contract HelbreathRH {
    string public constant name = "Chain Lords Helbreath";
    string public constant symbol = "HELBREATH";
    uint8 public constant decimals = 18;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    uint16 public constant MAX_TAX_BPS = 1_000; // 10%
    uint16 public constant DEFAULT_TAX_BPS = 500; // 5%

    address public owner;
    address public treasury;
    uint16 public taxBps = DEFAULT_TAX_BPS;
    address public dexPair;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public taxExcluded;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Tax(address indexed from, address indexed to, uint256 fee);
    event TaxBpsSet(uint16 bps);
    event PairSet(address indexed pair);
    event TreasurySet(address indexed treasury);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAddress();
    error TaxTooHigh();
    error NotOwner();
    error Insufficient();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address treasury_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        treasury = treasury_;
        taxExcluded[treasury_] = true;
        taxExcluded[msg.sender] = true;
        totalSupply = TOTAL_SUPPLY;
        balanceOf[treasury_] = TOTAL_SUPPLY;
        emit Transfer(address(0), treasury_, TOTAL_SUPPLY);
        emit OwnershipTransferred(address(0), msg.sender);
        emit TreasurySet(treasury_);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert Insufficient();
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function setTaxBps(uint16 bps) external onlyOwner {
        if (bps > MAX_TAX_BPS) revert TaxTooHigh();
        taxBps = bps;
        emit TaxBpsSet(bps);
    }

    function setTaxExcluded(address account, bool excluded) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        taxExcluded[account] = excluded;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        taxExcluded[treasury] = false;
        treasury = treasury_;
        taxExcluded[treasury_] = true;
        emit TreasurySet(treasury_);
    }

    function setDexPair(address pair) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        dexPair = pair;
        taxExcluded[pair] = true;
        emit PairSet(pair);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        taxExcluded[newOwner] = true;
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert Insufficient();

        uint256 fee;
        if (!taxExcluded[from] && !taxExcluded[to] && taxBps > 0) {
            fee = (amount * taxBps) / 10_000;
        }
        uint256 send = amount - fee;

        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += send;
        }
        emit Transfer(from, to, send);

        if (fee > 0) {
            unchecked {
                balanceOf[treasury] += fee;
            }
            emit Transfer(from, treasury, fee);
            emit Tax(from, to, fee);
        }
    }
}

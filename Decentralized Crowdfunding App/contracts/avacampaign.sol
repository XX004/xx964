// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract Campaign {
    string public title;
    string public description;
    uint public goal;
    uint public deadline;
    uint public totalRaised;
    address payable public creator;
    IERC20 public dogToken; //SSY
    address public factory;  
    bool public goalReached = false;
    bool public fundsWithdrawn = false;

    uint public originaltotalraised;
    mapping(address => uint) public usercontributions;

    mapping(address => uint) public contributions;
    address[] public contributors;
    mapping(address => bool) public hasContributed;

    event Contributed(address contributor, uint amount);
    event Refunded(address contributor, uint amount);
    event FundsWithdrawn(address creator, uint amount);

    struct ContributionRecord {
        address contributor;
        uint256 amount;
        uint256 timestamp;
    }
    ContributionRecord[] public contributionHistory;
    mapping(address => uint256[]) public userContributionIndices; //

    modifier onlyCreator() {
        require(msg.sender == creator, "Not creator");
        _;
    }

    constructor(
        string memory _title,
        string memory _description,
        uint _goal,
        uint _durationInSeconds,
        address _creator,
        address _dogToken,
        address _factory

    ) {
        title = _title;
        description = _description;
        goal = _goal;
        deadline = block.timestamp + _durationInSeconds;
        creator = payable(_creator);
        dogToken = IERC20(_dogToken);
        factory = _factory;   
    }

    function updateStatus() public {
        if (totalRaised >= goal && block.timestamp >= deadline) {
            goalReached = true; 
                
            bytes memory successData = abi. encodeWithSignature("recordSuccessfulCampaign()");
            (bool successCall, ) = factory.call(successData);
            require(successCall, "Campaign failed to update status");
            } 
 
        }

    function contribute() public payable {
        require(block.timestamp < deadline, "Campaign ended");
        require(msg.value > 0, "Contribution > 0");

        if (!hasContributed[msg.sender]) {
            contributors.push(msg.sender);
            hasContributed[msg.sender] = true;
        }

        usercontributions[msg.sender] += msg.value;
        originaltotalraised += msg.value;

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        contributionHistory.push(ContributionRecord({
            contributor: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));
        
        // Store the index for this user
        userContributionIndices[msg.sender].push(contributionHistory.length - 1);

        bytes memory data = abi.encodeWithSignature(
            "recordContribution(address,uint256)", 
            msg.sender, 
            msg.value
        );
        (bool success, ) = factory.call(data);
        require(success, "Contribute failed, must be more than 0 and ongoing");
        emit Contributed(msg.sender, msg.value);

        updateStatus();
    }
    //
    function getUserContributions(address user) public view returns (
            uint256[] memory amounts,
            uint256[] memory timestamps
        ) {
            uint256[] memory indices = userContributionIndices[user];
            amounts = new uint256[](indices.length);
            timestamps = new uint256[](indices.length);
            
            for (uint256 i = 0; i < indices.length; i++) {
                ContributionRecord memory record = contributionHistory[indices[i]];
                amounts[i] = record.amount;
                timestamps[i] = record.timestamp;
            }
            
            return (amounts, timestamps);
        }

    //
    function getTotalContributions() public view returns (uint256) {
        return contributionHistory.length;
    }

    //
    function getContributionRecord(uint256 index) public view returns (
        address contributor,
        uint256 amount,
        uint256 timestamp
    ) {
        require(index < contributionHistory.length, "Index out of bounds");
        ContributionRecord memory record = contributionHistory[index];
        return (record.contributor, record.amount, record.timestamp);
    }
    function withdrawFunds(uint256 start, uint256 end) public onlyCreator {
        updateStatus();
        require(!fundsWithdrawn, "Funds already withdrawn");
        require(totalRaised >= goal && block.timestamp >= deadline, "Campaign not successful");
        if (start >= end) {
            revert("Start index must be less than end index!");
        }
        if (end > contributors.length) {
            revert("End index exceeds contributor count!");
        }
        fundsWithdrawn = true; 

        uint amount = address(this).balance;

        for (uint256 i = start; i < end; i++) {
        address contributor = contributors[i];
        uint256 contributed = contributions[contributor];

        if (contributed == 0) continue;

        uint256 rewardAmount = (contributed / 1e16) * 1e18;
        if (rewardAmount == 0) continue; 

        dogToken.transfer(contributor, rewardAmount); //SSY
    }

        (bool success, ) = creator.call{value: amount}("");
        require(success, "Transfer failed");

        uint256 remainingTokens = dogToken.balanceOf(address(this));
        if (remainingTokens > 0) {
        require(
            dogToken.transfer(factory, remainingTokens),
         "Token refund failed"
        ); //SSY
    }

        emit FundsWithdrawn(creator, amount);
    }

    function refund() public {
        updateStatus();
        require(block.timestamp >= deadline && (totalRaised<goal), "Cannot refund");

        uint amount = contributions[msg.sender];
        require(amount > 0, "No contribution");

        contributions[msg.sender] = 0;
        totalRaised -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund failed");
        emit Refunded(msg.sender, amount);
    }

    function getContributors() public view returns (address[] memory) {
        return contributors;
    }

    function getContributorCount() public view returns (uint256) {
        return contributors.length;
    }


    function getProgress() public view returns (uint256) {
        if (goal == 0) return 0;
        return (originaltotalraised * 100) / goal;
    }

    function getStatusString() public view returns (string memory) {
        if (block.timestamp >= deadline){
            if (totalRaised >= goal){
                return "Successful";}
            else if (totalRaised < goal){
                return "Failed";}
            }   
        return "Ongoing";
    }

    function getTimeRemaining() public view returns (uint256) {
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }
    
    function canRefund(address user) public view returns (bool) {
        return 
            block.timestamp >= deadline && 
            (totalRaised < goal && 
            block.timestamp >= deadline) &&
            contributions[user] > 0;
    }

    function canWithdraw() public view returns (bool) {
        return
            msg.sender == creator &&           
            (totalRaised >= goal &&             
            block.timestamp >= deadline) &&
            !fundsWithdrawn ;
    }

    function getSummary() public view returns (
        string memory, string memory, uint, uint, uint, uint, bool, address, uint
    ) { 
        return (
            title, description, goal, totalRaised, deadline, 
            block.timestamp, goalReached, creator, originaltotalraised
        );
    }
}
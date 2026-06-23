// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./avacampaign.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Factory {
    
    address[] public deployedCampaigns;
    IERC20 public dogToken; 

    mapping(address => uint256) public totalContributionsByUser;
    mapping(address => uint256) public totalCampaignsContributedTo;
    address[] public allContributors;
    mapping(address => bool) public isContributor;
    mapping(address => mapping(address => bool)) public hasContributedToCampaign;


    uint256 public totalCampaignsCreated;
    uint256 public totalSuccessfulCampaigns;
    uint256 public totalFundsRaised;

    event CampaignCreated(address indexed campaignAddress, address indexed creator);
    event ContributionRecorded(address indexed contributor, address indexed campaign, uint256 amount);
    
    constructor(address _dogToken) {
        require(_dogToken != address(0), "Token address required");
        dogToken = IERC20(_dogToken);
    } 

    function createCampaign(
        string memory title,
        string memory description,
        uint goal,
        uint durationInSeconds
       
    ) public {
        uint256 rewardPool = 1_000_000 * 1e18; 
        Campaign newCampaign = new Campaign(
            title, description, goal, durationInSeconds, msg.sender, address(dogToken), address(this)
        );

        require(
        dogToken.transfer(address(newCampaign), rewardPool),
        "Campaign funding failed"
    ); 

        deployedCampaigns.push(address(newCampaign));
        totalCampaignsCreated++;

        emit CampaignCreated(address(newCampaign), msg.sender);
    }

    function recordContribution(address contributor, uint256 amount) external {
        bool isValidCampaign = false;
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            if (deployedCampaigns[i] == msg.sender) {
                isValidCampaign = true;
                break;
            }
        }
        require(isValidCampaign, "Only campaigns can record");

        if (!isContributor[contributor]) {
            allContributors.push(contributor);
            isContributor[contributor] = true;
        }

        if (!hasContributedToCampaign[contributor][msg.sender]) {
            totalCampaignsContributedTo[contributor]++;
            hasContributedToCampaign[contributor][msg.sender] = true;
        }

        totalContributionsByUser[contributor] += amount;
        totalFundsRaised += amount;

        emit ContributionRecorded(contributor, msg.sender, amount);
    }

    function recordSuccessfulCampaign() external {
        bool isValidCampaign = false;
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            if (deployedCampaigns[i] == msg.sender) { 
                isValidCampaign = true;
                break;
            }
        }
        require(isValidCampaign, "Only campaigns can record");
        
        totalSuccessfulCampaigns++;
    }

    function getTopContributors() public view returns (
        address[] memory contributors,
        uint256[] memory amounts,
        uint256[] memory campaignCounts
    ) {
        uint256 total = allContributors.length;
        
        uint256[] memory contribAmounts = new uint256[](total);
        uint256[] memory contribCounts = new uint256[](total);
        
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            
            if (block.timestamp >= camp.deadline() && camp.totalRaised() >= camp.goal()) {
                for (uint j = 0; j < total; j++) {
                    address contributor = allContributors[j];
                    uint256 contrib = camp.contributions(contributor);
                    if (contrib > 0) {
                        contribAmounts[j] += contrib;
                        contribCounts[j]++;
                    }
                }
            }
        }

        address[] memory resultContributors = new address[](10);
        uint256[] memory resultAmounts = new uint256[](10);
        uint256[] memory resultCounts = new uint256[](10);

        bool[] memory used = new bool[](total);
        uint256 count = 0;

        for (uint rank = 0; rank < 10; rank++) {
            uint256 maxAmount = 0;
            uint256 maxIndex = total;  

            for (uint j = 0; j < total; j++) {
                if (!used[j] && contribAmounts[j] > maxAmount) {
                    maxAmount = contribAmounts[j];
                    maxIndex = j;
                }
            }

            if (maxIndex == total || maxAmount == 0) {
                break;
            }

            resultContributors[count] = allContributors[maxIndex];
            resultAmounts[count] = contribAmounts[maxIndex];
            resultCounts[count] = contribCounts[maxIndex];

            used[maxIndex] = true;
            count++;
        }

        contributors = new address[](count);
        amounts = new uint256[](count);
        campaignCounts = new uint256[](count);

        for (uint i = 0; i < count; i++) {
            contributors[i] = resultContributors[i];
            amounts[i] = resultAmounts[i];
            campaignCounts[i] = resultCounts[i];
        }

        return (contributors, amounts, campaignCounts);
    }

    function getTopCampaigns() public view returns (
        address[] memory campaigns,
        uint256[] memory raised,
        string[] memory titles
    ) {
        uint256 successfulCount = 0;
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            if (camp.totalRaised() >= camp.goal() && block.timestamp >= camp.deadline()) {
                successfulCount++;
            }
        }
        uint256 count = successfulCount < 10 ? successfulCount : 10;
        
        campaigns = new address[](count);
        raised = new uint256[](count);
        titles = new string[](count);

        address[] memory successfulCampaigns = new address[](successfulCount);
        uint256 successIndex = 0;
        
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            if (camp.totalRaised() >= camp.goal() && block.timestamp >= camp.deadline()) {
                successfulCampaigns[successIndex] = deployedCampaigns[i];
                successIndex++;
            }
        }
        for (uint i = 0; i < successfulCount; i++) {
            for (uint j = i + 1; j < successfulCount; j++) {
                Campaign campI = Campaign(successfulCampaigns[i]);
                Campaign campJ = Campaign(successfulCampaigns[j]);
                if (campI.totalRaised() < campJ.totalRaised()) {
                    address temp = successfulCampaigns[i];
                    successfulCampaigns[i] = successfulCampaigns[j];
                    successfulCampaigns[j] = temp;
                }
            }
        }
        for (uint i = 0; i < count; i++) {
            campaigns[i] = successfulCampaigns[i];
            Campaign camp = Campaign(successfulCampaigns[i]);
            raised[i] = camp.totalRaised();
            titles[i] = camp.title();
        }

        return (campaigns, raised, titles);
    }

    function getUserContributionHistory(address user) public view returns (
        address[] memory campaignAddresses,
        string[] memory campaignTitles,
        uint256[][] memory amounts,
        uint256[][] memory timestamps
    ) {
        uint256 campaignCount = 0;
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            if (camp.usercontributions(user) > 0) {
                campaignCount++;
            }
        }

        campaignAddresses = new address[](campaignCount);
        campaignTitles = new string[](campaignCount);
        amounts = new uint256[][](campaignCount);
        timestamps = new uint256[][](campaignCount);

        uint256 index = 0;
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            if (camp.usercontributions(user) > 0) {
                campaignAddresses[index] = deployedCampaigns[i];
                campaignTitles[index] = camp.title();
                
                (uint256[] memory contribAmounts, uint256[] memory contribTimestamps) = 
                    camp.getUserContributions(user);
                
                amounts[index] = contribAmounts;
                timestamps[index] = contribTimestamps;
                
                index++;
            }
        }           //

        return (campaignAddresses, campaignTitles, amounts, timestamps);
    }

    function getPlatformStats() public view returns (
        uint256 _totalCampaigns,
        uint256 _successfulCampaigns,
        uint256 _totalFundsRaised,
        uint256 _totalContributors,
        uint256 _successRate
    ) {
        _totalCampaigns = totalCampaignsCreated;
        _successfulCampaigns = totalSuccessfulCampaigns;
        _totalFundsRaised = totalFundsRaised;
        _totalContributors = allContributors.length;
        _successRate = _totalCampaigns > 0 ? (_successfulCampaigns * 100) / _totalCampaigns : 0;
        
        return (_totalCampaigns, _successfulCampaigns, _totalFundsRaised, _totalContributors, _successRate);
    }

    function getDeployedCampaigns() public view returns (address[] memory) {
        return deployedCampaigns;
    }

    function getAllContributors() public view returns (address[] memory) {
        return allContributors;
    } 

    function searchCampaignsByTitle(string memory searchTerm) public view returns (address[] memory) {
        uint count = 0;
        bytes memory searchBytes = bytes(searchTerm);
        
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            bytes memory titleBytes = bytes(camp.title());
            
            // Simple contains check (case sensitive)
            if (contains(titleBytes, searchBytes)) {
                count++;
            }
        }
        
        address[] memory results = new address[](count);
        uint index = 0;
        
        for (uint i = 0; i < deployedCampaigns.length; i++) {
            Campaign camp = Campaign(deployedCampaigns[i]);
            bytes memory titleBytes = bytes(camp.title());
            
            if (contains(titleBytes, searchBytes)) {
                results[index++] = deployedCampaigns[i];
            }
        }
        
        return results;
    }

    function contains(bytes memory source, bytes memory search) private pure returns (bool) {
        if (search.length == 0) return true;
        if (source.length < search.length) return false;
        
        for (uint i = 0; i <= source.length - search.length; i++) {
            bool found = true;
            for (uint j = 0; j < search.length; j++) {
                if (source[i + j] != search[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

}
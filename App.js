import { useState, useEffect } from "react";
import Web3 from "web3";
import CampaignFactory from "./abis/Factory.json";
import Campaign from "./abis/Campaign.json";
import DogToken from "./abis/hottoDog.json";
import UserRegistration from "./abis/UserRegistration.json";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import CreateCampaignForm from "./components/CreateCampaignForm";
import RegisterForm from "./components/RegisterForm"; 

function App() {
  const [account, setAccount] = useState("");
  const [factory, setFactory] = useState(null);
  const [dogToken, setDogToken] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState("home");

  const [userRegistration, setUserRegistration] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userName, setUserName] = useState("");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    age: "",
    email: ""
  });

  const [userTokenBalance, setUserTokenBalance] = useState("0");
  const [totalTokenSupply, setTotalTokenSupply] = useState("0");
  const [tokenAddress, setTokenAddress] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("");
  const [timeUnit, setTimeUnit] = useState("minutes");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [topCampaigns, setTopCampaigns] = useState([]);
  const [topContributors, setTopContributors] = useState([]);

  const [userHistory, setUserHistory] = useState([]);
  const [platformStats, setPlatformStats] = useState({
    totalCampaigns: 0,
    successfulCampaigns: 0,
    totalFundsRaised: "0",
    totalContributors: 0,
    successRate: 0
  });

  useEffect(() => {
    checkIfConnected();
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          console.log("🔄 Account changed to:", accounts[0]);
          loadBlockchain(); 
        } else {
          setAccount("");
          setUserName("");
          setIsRegistered(false);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!factory) return;
    const interval = setInterval(async () => {
      const web3 = new Web3(window.ethereum);
      await loadCampaignsData(web3, factory, account);

      if (activePage === "leaderboard") {
        await loadLeaderboardData(factory);
      }

      if (activePage === "stats") {
        await loadPlatformStats(factory, web3);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [factory, account, activePage]);

  async function checkIfConnected() {
    if (!window.ethereum) {
      setLoading(false);
      return;
    }

    const web3 = new Web3(window.ethereum);
    const accounts = await web3.eth.getAccounts();

    if (accounts.length > 0) {
      loadBlockchain();
    } else {
      await loadCampaignsReadOnly(web3);
    }
  }

  async function loadBlockchain() {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }

    const web3 = new Web3(window.ethereum);
    const accounts = await web3.eth.getAccounts();

    if (accounts.length === 0) {
      await loadCampaignsReadOnly(web3);
      return;
    }

    setAccount(accounts[0]);

    const networkId = await web3.eth.net.getId();
    const factoryData = CampaignFactory.networks[networkId];

    if (!factoryData) {
      alert("Contracts not deployed to this network!");
      setLoading(false);
      return;
    }

    const factoryContract = new web3.eth.Contract(
      CampaignFactory.abi,
      factoryData.address
    );
    setFactory(factoryContract);

    const userRegistrationData = UserRegistration.networks[networkId];

      if (userRegistrationData) {
        const userRegistrationContract = new web3.eth.Contract(
          UserRegistration.abi,
          userRegistrationData.address
        );
        setUserRegistration(userRegistrationContract);

        try {
          console.log("👤 Checking user registration for:", accounts[0]);

          const userDetails = await userRegistrationContract.methods.getUserDetails(accounts[0]).call();
          console.log("User details:", userDetails);

          if (userDetails.isRegistered) {
              console.log("✅ User is registered as:", userDetails.name);

            setIsRegistered(true);
            setUserName(userDetails.name);
          }
        } catch (err) {
          console.log("User not registered yet");
        }
      }

    const tokenAddr = await factoryContract.methods.dogToken().call();
    setTokenAddress(tokenAddr);

    const tokenContract = new web3.eth.Contract(DogToken.abi, tokenAddr);
    setDogToken(tokenContract);

    const balance = await tokenContract.methods.balanceOf(accounts[0]).call();
    setUserTokenBalance(web3.utils.fromWei(balance.toString(), "ether"));

    const supply = await tokenContract.methods.balanceOf(factoryData.address).call();
    setTotalTokenSupply(web3.utils.fromWei(supply.toString(), "ether"));

    await loadCampaignsData(web3, factoryContract, accounts[0]);
    await loadLeaderboardData(factoryContract);

    const history = await loadUserHistory(factoryContract, accounts[0], web3);
    setUserHistory(history);

    const stats = await loadPlatformStats(factoryContract, web3);
    setPlatformStats(stats);

    setLoading(false);
  }

  async function loadCampaignsReadOnly(web3) {
    const networkId = await web3.eth.net.getId();
    const factoryData = CampaignFactory.networks[networkId];

    if (!factoryData) {
      alert("Contracts not deployed to this network!");
      setLoading(false);
      return;
    }

    const factoryContract = new web3.eth.Contract(
      CampaignFactory.abi,
      factoryData.address
    );

    await loadCampaignsData(web3, factoryContract, null);
    await loadLeaderboardData(factoryContract);

    const stats = await loadPlatformStats(factoryContract, web3);
    setPlatformStats(stats);

    setLoading(false);
  }

  async function loadCampaignsReadOnly(web3) {
    const networkId = await web3.eth.net.getId();
    
     const factoryData = CampaignFactory.networks[networkId];
    if (!factoryData) {
       alert("Contracts not deployed to this network!");
       setLoading(false);
       return;
     }
    
     const factoryContract = new web3.eth.Contract(CampaignFactory.abi, factoryData.address);
     await loadCampaignsData(web3, factoryContract, null);
     await loadLeaderboardData(factoryContract);

     const stats = await loadPlatformStats(factoryContract, web3);
     setPlatformStats(stats);

    setLoading(false);
  }

  async function loadCampaignsData(web3, factoryContract, userAccount) {
    const campaignAddresses = await factoryContract.methods.getDeployedCampaigns().call();
    const campaignList = [];

    for (let addr of campaignAddresses) {
       const camp = new web3.eth.Contract(Campaign.abi, addr);

       const summary = await camp.methods.getSummary().call();

       const canWithdraw = userAccount ? 
       await camp.methods.canWithdraw().call({ from: userAccount }): false;
       const canRefund = userAccount ? 
       await camp.methods.canRefund(userAccount).call() : false;

       const status = await camp.methods.getStatusString().call();
       const progress = await camp.methods.getProgress().call();

       const timeRemaining = await camp.methods.getTimeRemaining().call();
       const formattedTimeRemaining = formatTimeRemaining(timeRemaining);

       const contributorCount = await camp.methods.getContributorCount().call();
       const fundsWithdrawn = await camp.methods.fundsWithdrawn().call();

       let userContribution = "0";
       let originalUserContribution = "0";

       if (userAccount) {
         const contrib = await camp.methods.contributions(userAccount).call();
         userContribution = web3.utils.fromWei(contrib.toString(), "ether");

         const origContrib = await camp.methods.usercontributions(userAccount).call();
         originalUserContribution = web3.utils.fromWei(origContrib.toString(), "ether");
       }

       campaignList.push({
         address: addr,
         title: summary[0],
         description: summary[1],
         goal: web3.utils.fromWei(summary[2].toString(), "ether"),
         raised: web3.utils.fromWei(summary[3].toString(), "ether"),
         originaltotalraised: web3.utils.fromWei(summary[8].toString(), "ether"),
         deadline: new Date(Number(summary[4]) * 1000).toLocaleString(),
         deadlineTimestamp: Number(summary[4]) * 1000,
         goalReached: summary[6],
         creator: summary[7],
         status: status,
         progress: progress.toString(),
         timeRemaining: formattedTimeRemaining,
         contributorCount: contributorCount.toString(),
         userContribution: originalUserContribution,
         canWithdraw: canWithdraw,
         canRefund: canRefund,
         fundsWithdrawn: fundsWithdrawn,
         contract: camp,
         web3: web3
       });
    }

    setCampaigns(campaignList);
  }

  async function loadLeaderboardData(factoryContract) {
    const topCamps = await factoryContract.methods.getTopCampaigns().call();

    const campaignsData = topCamps[0].map((addr, index) => ({
      address: addr,
      raised: Web3.utils.fromWei(topCamps[1][index].toString(), "ether"),
      title: topCamps[2][index]
    }));
    
    setTopCampaigns(campaignsData);

    const topContribs = await factoryContract.methods.getTopContributors().call();
    
    const contributorsData = topContribs[0].map((addr, index) => ({
      address: addr,
      amount: Web3.utils.fromWei(topContribs[1][index].toString(), "ether"),
      campaignCount: topContribs[2][index].toString()
    }));
    
    setTopContributors(contributorsData);
  }

  async function loadUserHistory(factoryContract, userAccount, web3) {
      const history = await factoryContract.methods.getUserContributionHistory(userAccount).call();
      const historyList = [];

      for (let i = 0; i < history[0].length; i++) {
        const addr = history[0][i];
        const camp = new web3.eth.Contract(Campaign.abi, addr);
        const status = await camp.methods.getStatusString().call();
   
            //
        const amounts = history[2][i];
        const timestamps = history[3][i]; 
        for (let j = 0; j < amounts.length; j++) {
          historyList.push({
            address: addr,
            title: history[1][i],                   
            status:status,
            amount: web3.utils.fromWei(amounts[j].toString(), "ether"),
            timestamp: new Date(Number(timestamps[j]) * 1000).toLocaleString(),
            timestampRaw: Number(timestamps[j])
          });
      }
    }
      historyList.sort((a, b) => b.timestampRaw - a.timestampRaw);
      return historyList;
    } 
  

  async function loadPlatformStats(factoryContract, web3) {
      const stats = await factoryContract.methods.getPlatformStats().call();

      return {
        totalCampaigns: stats[0].toString(),
        successfulCampaigns: stats[1].toString(),
        totalFundsRaised: web3.utils.fromWei(stats[2].toString(), "ether"),
        totalContributors: stats[3].toString(),
        successRate: stats[4].toString()
      };
  }

  const handleCreateCampaign = async () => {
    if (!title || !description || !goal || !duration) {
      return alert("Please fill all fields");
    }

    setLoading(true);
    try {
      let durationInSeconds;
      if (timeUnit === "minutes") {
        durationInSeconds = duration * 60;
      } else if (timeUnit === "seconds") {
        durationInSeconds = duration;
      } else if (timeUnit === "hours") {
        durationInSeconds = duration * 3600;
      } else {
        durationInSeconds = duration * 86400;
      }

      await factory.methods
        .createCampaign(title, description, Web3.utils.toWei(goal, "ether"), durationInSeconds)
        .send({ 
          from: account,
          gas: 3000000 
        });

      alert("Campaign created successfully!");
      setTitle("");
      setDescription("");
      setGoal("");
      setDuration("");
      setTimeout(() => loadBlockchain(), 2000);
      setLoading(false);
    } catch (err) {
      alert("Error creating campaign: " + err.message);
      setLoading(false);
    }
  };

  const registerUser = async () => {
    if (!userRegistration) {
      alert("Contract not loaded. Please make sure it's deployed to this network.");
      return;
    }
    if (!registerForm.name || !registerForm.age || !registerForm.email) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      await userRegistration.methods
        .registerUser(registerForm.name, registerForm.age, registerForm.email)
        .send({ from: account, gas: 300000 });

      setIsRegistered(true);
      setUserName(registerForm.name);
      setShowRegisterModal(false);
      setRegisterForm({ name: "", age: "", email: "" });
      alert("Registration successful!");
    } catch (err) {
      alert("Registration failed: " + err.message);
    }
    setLoading(false);
  };

  const searchCampaigns = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await factory.methods.searchCampaignsByTitle(searchQuery).call();
      
      const web3 = new Web3(window.ethereum);
      const searchList = [];

      for (let addr of results) {
        const camp = new web3.eth.Contract(Campaign.abi, addr);
        const summary = await camp.methods.getSummary().call();
        const status = await camp.methods.getStatusString().call();
        const progress = await camp.methods.getProgress().call();
        const timeRemaining = await camp.methods.getTimeRemaining().call();
        const formattedTimeRemaining = formatTimeRemaining(timeRemaining);

        const contributorCount = await camp.methods.getContributorCount().call();
        const fundsWithdrawn = await camp.methods.fundsWithdrawn().call();
        
        let userContribution = "0";
        let originalUserContribution = "0";

        let canWithdraw = false;
        let canRefund = false;
        if (account) {
          const contrib = await camp.methods.contributions(account).call();
          userContribution = web3.utils.fromWei(contrib.toString(), "ether");
          const origContrib = await camp.methods.usercontributions(account).call();
          originalUserContribution = web3.utils.fromWei(origContrib.toString(), "ether");
          canWithdraw = await camp.methods.canWithdraw().call({ from: account });
          canRefund = await camp.methods.canRefund(account).call();
        }
        
        searchList.push({
          address: addr,
          title: summary[0],
          description: summary[1],
          goal: web3.utils.fromWei(summary[2].toString(), "ether"),
          raised: web3.utils.fromWei(summary[3].toString(), "ether"),
          originaltotalraised: web3.utils.fromWei(summary[8].toString(), "ether"),
          deadline: new Date(Number(summary[4]) * 1000).toLocaleString(),
          creator: summary[7],
          status: status,
          progress: progress.toString(),
          timeRemaining: formattedTimeRemaining,
          contributorCount: contributorCount.toString(),
          userContribution: originalUserContribution,
          canWithdraw: canWithdraw,
          canRefund: canRefund,
          fundsWithdrawn: fundsWithdrawn,
          contract: camp,
          web3: web3
        });
      }
      setSearchResults(searchList);
    } catch (err) {
      alert("Search failed: " + err.message);
    }
    setIsSearching(false);
  };

  const contribute = async (addr) => {
    const amount = prompt("Enter contribution amount in ETH");
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      const web3 = new Web3(window.ethereum);
       const camp = new web3.eth.Contract(Campaign.abi, addr);
      
       await camp.methods.contribute().send({
         from: account,
         value: Web3.utils.toWei(amount, "ether"),
        gas: 3000000
       });

      const tokens = parseFloat(amount) / 0.01;
      alert(`Contribution successful! You will receive ${tokens} hotDog tokens\nif this campaign is successful.`);
      loadBlockchain();
    } catch (err) {
      alert("Contribution failed: " + err.message);
    }
  };
  
  const withdraw = async (addr) => {
  try {
    setLoading(true);
    const web3 = new Web3(window.ethereum);
    const camp = new web3.eth.Contract(Campaign.abi, addr);

    const contributorCount = await camp.methods.getContributorCount().call();

    await camp.methods
      .withdrawFunds(0, 12)
      .send({ from: account, gas: 3000000 });

    alert("Funds withdrawn successfully!");
    loadBlockchain();
  } catch (err) {
    alert("Withdraw failed: " + err.message);
    setLoading(false);
  }
};

  const refund = async (addr) => {
    try {
      const web3 = new Web3(window.ethereum);
      const camp = new web3.eth.Contract(Campaign.abi, addr);
      
      await camp.methods.refund().send({ from: account, gas: 3000000 });
      
      alert("Refund processed successfully!");
      loadBlockchain();
    } catch (err) {
      alert("Refund failed: " + err.message);
    }
  };

  const formatTimeRemaining = (seconds) => {
    const timeInSeconds = parseInt(seconds);
    if (timeInSeconds <= 0) {
      return "Expired";
    }
    const days = Math.floor(timeInSeconds / 86400);
    const hours = Math.floor((timeInSeconds % 86400) / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const secs = timeInSeconds % 60;
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) return <div className="text-center mt-5"><h2>Loading... </h2>
  </div>;

  const Header = () => (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">Fundavail</span>


        <div className="navbar-nav ms-auto">
          <button 
            className={`btn btn-link nav-link ${activePage === 'home' ? 'active' : ''}`}
            onClick={() => setActivePage('home')}
          >
            Home
          </button>
          
          <button 
            className={`btn btn-link nav-link ${activePage === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActivePage('leaderboard')}
          >
            Leaderboard
          </button>
          <button 
            className={`btn btn-link nav-link ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => setActivePage('history')}
          >
            My History
          </button>
          <button 
            className={`btn btn-link nav-link ${activePage === 'stats' ? 'active' : ''}`}
            onClick={() => setActivePage('stats')}
          >
            Platform 
          </button>

          {account && (
            isRegistered ? (
              <span className="navbar-text text-white ms-3">
                👋 Welcome, {userName}!
              </span>
            ) : (
              <button 
                className="btn btn-outline-light btn-sm ms-3"
                onClick={() => setShowRegisterModal(true)}
              >
                Register
              </button>
            )
        )}
        </div>
      </div>
    </nav>
  );

  const AccountInfo = () => (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title">Account Information</h5>
        {account ? (
          <>
            <p><strong>Address:</strong> {account}</p>
            <p><strong>hotDog Token Balance:</strong> {parseFloat(userTokenBalance).toFixed(2)} hotDog</p>
            <p><strong>Total Supply:</strong> {parseFloat(totalTokenSupply).toFixed(2)} hotDog</p>
            <p><strong>Token Contract:</strong> <small>{tokenAddress}</small></p>
          </>
        ) : (
          <p>Please connect your wallet to view account information</p>
        )}
      </div>
    </div>
  );



  const CampaignCard = ({ campaign }) => {
    const isCreator = account && campaign.creator.toLowerCase() === account.toLowerCase();
    const hasContributed = parseFloat(campaign.userContribution) > 0;
    const isOngoing = campaign.status === "Ongoing";

    const canWithdraw = campaign.canWithdraw;
    const canRefund = campaign.canRefund;

    return (
      <div className="card mb-3 h-100">
        <div className="card-body d-flex flex-column">
          <h5 className="card-title">{campaign.title}</h5>
          <p className="card-text">{campaign.description}</p>
          
          <div className="mb-2">
            <span className={`badge ${
              campaign.status === 'Ongoing' ? 'bg-info' :
              campaign.status === 'Successful' ? 'bg-success' : 'bg-danger'
            }`}>
              {campaign.status}
            </span>
          </div>

          <div className="progress mb-2" style={{ height: '25px' }}>
            <div 
              className="progress-bar" 
              role="progressbar" 
              style={{ width: `${Math.min(campaign.progress, 100)}%` }}
            >
              {Math.min(campaign.progress, 100)}%  
            </div> 
          </div>

          <p className="mb-1"><strong>Goal:</strong> {campaign.goal} ETH</p>
          <p className="mb-1"><strong>Raised:</strong> {campaign.originaltotalraised} ETH</p>
          <p className="mb-1"><strong>Deadline:</strong> {campaign.deadline}</p>
          <p className="mb-1"><strong>Time Remaining:</strong> {campaign.timeRemaining}</p>
          <p className="mb-1"><strong>Contributors:</strong> {campaign.contributorCount}</p>
          <p className="mb-1"><strong>Creator:</strong> <small>{campaign.creator}</small></p>
          
          {hasContributed && (
            <p className="mb-1 text-success">
              <strong>Your Contribution:</strong> {campaign.userContribution} ETH
            </p>
          )}

          <div className="mt-3">
            {account ? (
              <>
                {isOngoing && !isCreator && (
                  <button 
                    className="btn btn-success me-2"
                    onClick={() => contribute(campaign.address)}
                  >
                    Contribute
                  </button>
                )}
                
                {canWithdraw && (
                  <button 
                    className="btn btn-primary me-2"
                    onClick={() => withdraw(campaign.address)}
                  >
                    Withdraw Funds
                  </button>
                )}

                {campaign.fundsWithdrawn && (
                  <p className="mb-1 text-muted">
                    <small>✓ Funds withdrawn </small>
                  </p>
                )}
                
                {canRefund && (
                  <button 
                    className="btn btn-warning"
                    onClick={() => refund(campaign.address)}
                  >
                    Claim Refund
                  </button>
                )}
              </>
            ) : (
              <p className="text-muted">Connect wallet to interact</p>
            )}
          </div>
        </div>
      </div>
    );
  };

 const LeaderboardPage = () => {
    return (
      <div className="container mt-4">
        <h2 className="text-center mb-4">🏆 Leaderboard</h2>
        <div className="row">
          <div className="col-md-6 mb-4"> 
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h5>Top 10 Campaigns</h5>
              </div>
              <div className="card-body">
                {topCampaigns.length > 0 ? (
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Raised (ETH)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCampaigns.map((camp, index) => (
                        <tr key={camp.address}>
                          <td>{index + 1}</td>
                          <td>{camp.title}</td>
                          <td>{parseFloat(camp.raised).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted">No successful campaigns yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6 mb-4">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h5>Top 10 Contributors</h5>
              </div>
              <div className="card-body">
                {topContributors.length > 0 ? (
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Address</th>
                        <th>Total (ETH)</th>
                        <th>Campaigns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topContributors.map((contrib, index) => (
                        <tr key={contrib.address}>
                          <td>{index + 1}</td>
                          <td><small>{contrib.address.slice(0, 6)}...{contrib.address.slice(-4)}</small></td>
                          <td>{parseFloat(contrib.amount).toFixed(4)}</td>
                          <td>{contrib.campaignCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted">No successful contributors yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TransactionHistoryPage = () => {
      if (!account) {
        return (
          <div className="container mt-4">
            <h2 className="text-center mb-4">📜 My Transaction History</h2>
            <div className="alert alert-warning text-center">
              Please connect your wallet to view transaction history
            </div>
          </div>
        );
      }

      return (
        <div className="container mt-4">
          <h2 className="text-center mb-4">📜 My Transaction History</h2>
          
          {userHistory.length > 0 ? (
            <div className="card">
              <div className="card-body">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userHistory.map((contribution, index) => (
                      <tr key={`${contribution.address}-${index}`}>
                        <td>{contribution.timestamp}</td>
                        <td>
                          <strong>{contribution.title}</strong>
                          <br />
                          <small className="text-muted">
                            {contribution.address.slice(0, 6)}...{contribution.address.slice(-4)}
                          </small>
                        </td>
                        <td>
                          <span className={`badge ${
                            contribution.status === 'Ongoing' ? 'bg-info' :
                            contribution.status === 'Successful' ? 'bg-success' : 'bg-danger'
                          }`}>
                            {contribution.status}
                          </span>
                        </td>
                        <td>
                          <strong>{contribution.amount} ETH</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="alert alert-info text-center">
              You haven't contributed to any campaigns yet
            </div>
          )}
        </div>
      );
  };

  const PlatformStatsPage = () => {
    return (
      <div className="container mt-4">
        <h2 className="text-center mb-4">📊 Our platform </h2>
        
        <div className="row">
          <div className="col-md-6 col-lg-3 mb-4">
            <div className="card text-center bg-primary text-white">
              <div className="card-body">
                <h5 className="card-title">📋 Total Campaigns</h5>
                <h2 className="display-4">{platformStats.totalCampaigns}</h2>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3 mb-4">
            <div className="card text-center bg-success text-white">
              <div className="card-body">
                <h5 className="card-title">✅ Successful</h5>
                <h2 className="display-4">{platformStats.successfulCampaigns}</h2>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3 mb-4">
            <div className="card text-center bg-info text-white">
              <div className="card-body">
                <h5 className="card-title">👥 Contributors</h5>
                <h2 className="display-4">{platformStats.totalContributors}</h2>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3 mb-4">
            <div className="card text-center bg-warning text-white">
              <div className="card-body">
                <h5 className="card-title">🎯 Success Rate</h5>
                <h2 className="display-4">{platformStats.successRate}%</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-3">
          <div className="col-12">
            <div className="card text-center">
              <div className="card-body">
                <h5 className="card-title">💰 Total Funds Raised</h5>
                <h1 className="display-3 text-primary">{parseFloat(platformStats.totalFundsRaised).toFixed(4)} ETH</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Header />
      <RegisterForm 
      showRegisterModal={showRegisterModal}
      setShowRegisterModal={setShowRegisterModal}
      registerForm={registerForm}
      setRegisterForm={setRegisterForm}
      registerUser={registerUser}
      loading={loading}
    />
      <div className="bg-primary pt-3 pb-4">  
        <div className="container">
          <div className="d-flex justify-content-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <input 
            type="text" 
            className="form-control me-2" 
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchCampaigns()}
          />
            <button className="btn btn-light me-2" onClick={searchCampaigns} disabled={!factory || isSearching}>
              🔍
            </button>
            {searchQuery && (
              <button className="btn btn-outline-light" onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
      
      {activePage === 'home' && (
        <div className="container mt-4">
          <h1 className="text-center mb-4"> Decentralized Crowdfunding Platform</h1>
          
          <AccountInfo />
          {account ? (
              <button 
                className="btn btn-secondary mb-3 me-2"
                onClick={() => window.location.reload()}
              >
                🔄 Reload Account
              </button>
          ) : (
            <button 
              className="btn btn-primary mb-3"
              onClick={async () => {
                await window.ethereum.request({ method: "eth_requestAccounts" });
                loadBlockchain();
              }}
            >
              🔗 Connect Wallet
            </button>
          )}

          {account && (
            <div className="mb-4">
              <button 
                className="btn btn-dark d-block mx-auto mb-3"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "❌ Cancel" : "➕ Create New Campaign"}
              </button>
              {showForm && (
                <div className="card card-body bg-light">
                  <CreateCampaignForm 
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    goal={goal}
                    setGoal={setGoal}
                    duration={duration}
                    setDuration={setDuration}
                    timeUnit={timeUnit}
                    setTimeUnit={setTimeUnit}
                    handleCreateCampaign={handleCreateCampaign}
                    loading={loading}
                    account={account} 
                  />
                </div>
              )}
            </div>
          )}
            
          <h3 className="mt-4 mb-3">
          {searchResults.length > 0 
            ? `Search Results (${searchResults.length})` 
            : searchQuery 
            ? 'No results found' 
            : 'All Campaigns'}
        </h3>
    
        {(searchResults.length > 0 ? searchResults : campaigns).length > 0 ? (
          <div className="row">
          {(searchResults.length > 0 ? searchResults : campaigns).map(campaign => (
            <div className="col-md-4 mb-4" key={campaign.address}>
              <CampaignCard campaign={campaign} />
            </div>
          ))}
        </div>) :
         (
            <div className="alert alert-info text-center">
              {searchQuery ? `No campaigns found for "${searchQuery}"` : 'No campaigns created yet. Be the first!'}
            </div>
          )}
          </div>
          )}
          {activePage === 'leaderboard' && <LeaderboardPage />}
          {activePage === 'history' && <TransactionHistoryPage />}
          {activePage === 'stats' && <PlatformStatsPage />}
    </>
  );
}

export default App;
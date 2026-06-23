// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract UserRegistration {
    struct User {
        string name;
        uint256 age;
        string email;
        bool isRegistered;
    }

    mapping(address => User) public users;

    event UserRegistered(
        address indexed userAddress,
        string name,
        uint256 age,
        string email
    );

    function registerUser( string memory _name, uint256 _age, string memory _email) public {
        require(!users[msg.sender].isRegistered, "User already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_age > 0, "Age must be greater than 0");
        require(bytes(_email).length > 0, "Email cannot be empty");

        users[msg.sender] = User({
            name: _name,
            age: _age,
            email: _email,
            isRegistered: true
        });

        emit UserRegistered(msg.sender, _name, _age, _email);
    }

    function getUserDetails(address _userAddress)
        public
        view
        returns (
            string memory name,
            uint256 age,
            string memory email,
            bool isRegistered
        )
    {
        User memory user = users[_userAddress];
        return (user.name, user.age, user.email, user.isRegistered);
    }
}
const HottoDog = artifacts.require("hottoDog");
const Factory = artifacts.require("Factory");
const UserRegistration = artifacts.require("UserRegistration");

module.exports = async function(deployer, network, accounts) {
    await deployer.deploy(HottoDog);
    const token = await HottoDog.deployed();
    console.log("Token deployed at:", token.address);

    await deployer.deploy(Factory, token.address);
    const factory = await Factory.deployed();
    console.log("Factory deployed at:", factory.address);

    await deployer.deploy(UserRegistration);
    const userRegistration = await UserRegistration.deployed();
    console.log("UserRegistration deployed at:", userRegistration.address);

    await token.mintToFactory(factory.address);
    console.log("Tokens minted to factory:", factory.address);
};

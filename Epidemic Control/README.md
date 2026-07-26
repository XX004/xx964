# Epidemic Control via Reinforcement Learning
(Download the file to view)

A reinforcement learning framework for optimizing pandemic response policies, balancing economic output against public health outcomes using a custom SEIRD epidemic simulation environment.

## Overview

This project implements and compares multiple RL algorithms for learning lockdown/reopening policies in a simulated pandemic. Agents must decide daily restriction levels that trade off economic activity against infection spread and mortality.

## Environment

**`EpidemicEnv`** — A custom Gymnasium-style environment implementing SEIRD (Susceptible-Exposed-Infected-Recovered-Deceased) epidemic dynamics.

### Reward Function

reward = E_econ * exp(-r * infection_rate) - s * death_rate

Balances economic output against exponentially-weighted infection penalties and linear death penalties. Configurable via `agent_type` ("balanced" vs "economy-prioritized").

## Algorithms Implemented

| Algorithm | Description |
|---|---|
| **D3QN** | Dueling Double Deep Q-Network with experience replay and target network — the primary/baseline agent for this discrete-action environment |
| **CPO** | Constrained Policy Optimization — PPO-style policy gradient with a Lagrangian multiplier that penalizes death-rate violations, enforcing a safety constraint |
| **Decision Transformer** | Offline sequence model — a causal Transformer trained on collected trajectories to predict actions conditioned on a target Return-to-Go |
| **DreamerV3-lite** | Model-based agent with a GRU world model learning latent dynamics; actor-critic trained entirely on *imagined* rollouts |
| **MuZero-lite** | Learns representation, dynamics, and prediction networks; plans via Monte Carlo Tree Search over the learned model |

## Contents

- **Environment & Reward Module** — SEIRD dynamics and `RewardCalculator`
- **D3QN Agent** — Dueling architecture, Double DQN target computation, experience replay buffer
- **Hyperparameter Grid Search** — sweeps over learning rate (`1e-3`, `5e-4`), discount factor (`0.95`, `0.99`), and exploration strategy (`epsilon-greedy`, `Boltzmann`)
- **Cross-Algorithm Environment Compatibility Check** — validates D3QN-style setups against classic control/Atari environments (`Pendulum-v1`, `ALE/Breakout-v5`, `CarRacing-v3`, `ALE/Pong-v5`) for discrete/continuous action space handling
- **Multi-Algorithm Benchmark** — trains CPO, Decision Transformer, DreamerV3-lite, and MuZero-lite on `EpidemicEnv` and compares reward curves and final performance




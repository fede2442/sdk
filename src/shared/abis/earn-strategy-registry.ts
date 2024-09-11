export default [
  {
    inputs: [{ internalType: 'StrategyId', name: 'strategyId', type: 'uint96' }],
    name: 'getStrategy',
    outputs: [{ internalType: 'contract IEarnStrategy', name: 'strategy', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
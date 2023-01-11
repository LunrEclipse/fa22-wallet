import { ethers } from 'ethers';
import log from 'loglevel';
import BigNumber from 'bignumber.js';
import { ObservableStore } from '@metamask/obs-store';
import { mapValues, cloneDeep } from 'lodash';
import abi from 'human-standard-token-abi';
import {
  conversionUtil,
  decGWEIToHexWEI,
  addCurrencies,
} from '../../../shared/modules/conversion.utils';
import {
  DEFAULT_ERC20_APPROVE_GAS,
  QUOTES_EXPIRED_ERROR,
  QUOTES_NOT_AVAILABLE_ERROR,
  SWAPS_FETCH_ORDER_CONFLICT,
  SWAPS_CHAINID_CONTRACT_ADDRESS_MAP,
} from '../../../shared/constants/swaps';
import { GAS_ESTIMATE_TYPES } from '../../../shared/constants/gas';
import {
  FALLBACK_SMART_TRANSACTIONS_REFRESH_TIME,
  FALLBACK_SMART_TRANSACTIONS_DEADLINE,
  FALLBACK_SMART_TRANSACTIONS_MAX_FEE_MULTIPLIER,
} from '../../../shared/constants/smartTransactions';

import { isSwapsDefaultTokenAddress } from '../../../shared/modules/swaps.utils';

import {
  fetchTradesInfo as defaultFetchTradesInfo,
  getBaseApi,
} from '../../../shared/lib/swaps-utils';
import fetchWithCache from '../../../shared/lib/fetch-with-cache';
import { MINUTE, SECOND } from '../../../shared/constants/time';
import { isEqualCaseInsensitive } from '../../../shared/modules/string-utils';
import {
  calcGasTotal,
  calcTokenAmount,
} from '../../../shared/lib/transactions-controller-utils';

import stargateABI from "../utils/ethRouter"

import { NETWORK_EVENTS } from './network';

// The MAX_GAS_LIMIT is a number that is higher than the maximum gas costs we have observed on any aggregator
const MAX_GAS_LIMIT = 2500000;

// To ensure that our serves are not spammed if MetaMask is left idle, we limit the number of fetches for quotes that are made on timed intervals.
// 3 seems to be an appropriate balance of giving users the time they need when MetaMask is not left idle, and turning polling off when it is.
const POLL_COUNT_LIMIT = 3;

// If for any reason the MetaSwap API fails to provide a refresh time,
// provide a reasonable fallback to avoid further errors
const FALLBACK_QUOTE_REFRESH_TIME = MINUTE;

const initialState = {
  swapsState: {
    quotes: {},
    quotesPollingLimitEnabled: false,
    fetchParams: null,
    tokens: null,
    tradeTxId: null,
    approveTxId: null,
    quotesLastFetched: null,
    customMaxGas: '',
    customGasPrice: null,
    customMaxFeePerGas: null,
    customMaxPriorityFeePerGas: null,
    swapsUserFeeLevel: '',
    selectedAggId: null,
    customApproveTxData: '',
    errorKey: '',
    topAggId: null,
    routeState: '',
    swapsFeatureIsLive: true,
    saveFetchedQuotes: false,
    swapsQuoteRefreshTime: FALLBACK_QUOTE_REFRESH_TIME,
    swapsQuotePrefetchingRefreshTime: FALLBACK_QUOTE_REFRESH_TIME,
    swapsStxBatchStatusRefreshTime: FALLBACK_SMART_TRANSACTIONS_REFRESH_TIME,
    swapsStxGetTransactionsRefreshTime:
      FALLBACK_SMART_TRANSACTIONS_REFRESH_TIME,
    swapsStxMaxFeeMultiplier: FALLBACK_SMART_TRANSACTIONS_MAX_FEE_MULTIPLIER,
    swapsFeatureFlags: {},
  },
};

export default class BridgeController {
  constructor({
    getBufferedGasLimit,
    networkController,
    provider,
    getProviderConfig,
    getTokenRatesState,
    fetchTradesInfo = defaultFetchTradesInfo,
    getCurrentChainId,
    getEIP1559GasFeeEstimates,
  }) {
    this.store = new ObservableStore({
      swapsState: { ...initialState.swapsState },
    });

    this._fetchTradesInfo = fetchTradesInfo;
    this._getCurrentChainId = getCurrentChainId;
    this._getEIP1559GasFeeEstimates = getEIP1559GasFeeEstimates;

    this.getBufferedGasLimit = getBufferedGasLimit;
    this.getTokenRatesState = getTokenRatesState;

    this.pollCount = 0;
    this.getProviderConfig = getProviderConfig;

    this.indexOfNewestCallInFlight = 0;

    this.ethersProvider = new ethers.providers.Web3Provider(provider);
    this._currentNetwork = networkController.store.getState().network;
    networkController.on(NETWORK_EVENTS.NETWORK_DID_CHANGE, (network) => {
      if (network !== 'loading' && network !== this._currentNetwork) {
        this._currentNetwork = network;
        this.ethersProvider = new ethers.providers.Web3Provider(provider);
      }
    });
  }

  async executeBridgeTransaction(address, destinationChain, quantity) {
    const contract = new ethers.Contract(
      contractAddress,
      stargateABI,
      this.ethersProvider,
    );

  //Starting Chain
  const stargateAddr = "";
  if(this._getCurrentChainId == 5) {
    stargateAddr = "0xdb19Ad528F4649692B92586828346beF9e4a3532"
  } else if (this._currentNetwork == 420) {
    stargateAddr = "0xc744E5c3E5A4F6d70Df217a0837D32B05a951d08"
  } else {
    stargateAddr = "0x7612aE2a34E5A363E137De748801FB4c86499152"
  }
  //EthRouter Georli: 0xdb19Ad528F4649692B92586828346beF9e4a3532
  //EthRouter Arbitrum: 0x7612aE2a34E5A363E137De748801FB4c86499152
  //EthRouter Optimism: 0xc744E5c3E5A4F6d70Df217a0837D32B05a951d08
  /*
    args 
    uint16 _dstChainId,
    address payable _refundAddress,
    bytes calldata _to,
    uint256 _amountLD,
    uint256 _minAmountLD
  */

    let messageFee = ethers.utils.parseEther('0.025');  
    let quantity = ethers.utils.parseEther('0.01'); 
    let min = ethers.utils.parseEther('0.005');
    let message = ethers.utils.formatBytes32String(""); 

    //Destination Chain
    //Arbitrum Pool ID: 10143
    //Goerli Pool ID: 10121
    //Optimism Pool ID: 10132
    this.
    getSelectedAccount(state).address
  return await contract.swapETH(
    destinationChain,
    address, //user's address
    address, //user's address
    quantity,
    min,
    {value: messageFee, gasLimit: 1000000}
  )
  }

  async _getERC20Allowance(contractAddress, walletAddress, chainId) {
    const contract = new ethers.Contract(
      contractAddress,
      abi,
      this.ethersProvider,
    );
    return await contract.allowance(
      walletAddress,
      SWAPS_CHAINID_CONTRACT_ADDRESS_MAP[chainId],
    );
  }
}


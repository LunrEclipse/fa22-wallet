import EthQuery from 'ethjs-query';
import log from 'loglevel';
import { addHexPrefix } from 'ethereumjs-util';
import { cloneDeep } from 'lodash';
import { hexToBn, BnMultiplyByFraction, bnToHex } from '../../lib/util';
import axios from 'axios';

/**
 * Result of gas analysis, including either a gas estimate for a successful analysis, or
 * debug information for a failed analysis.
 *
 * @typedef {object} GasAnalysisResult
 * @property {string} blockGasLimit - The gas limit of the block used for the analysis
 * @property {string} estimatedGasHex - The estimated gas, in hexadecimal
 * @property {object} simulationFails - Debug information about why an analysis failed
 */

/**
 * tx-gas-utils are gas utility methods for Transaction manager
 * its passed ethquery
 * and used to do things like calculate gas of a tx.
 *
 * @param {object} provider - A network provider.
 */

export default class TxGasUtil {
  constructor(provider) {
    this.query = new EthQuery(provider);
  }

  /**
   * @param {object} txMeta - the txMeta object
   * @returns {GasAnalysisResult} The result of the gas analysis
   */
  async analyzeGasUsage(txMeta) {
    const block = await this.query.getBlockByNumber('latest', false);

    // fallback to block gasLimit
    const blockGasLimitBN = hexToBn(block.gasLimit);
    const saferGasLimitBN = BnMultiplyByFraction(blockGasLimitBN, 19, 20);
    let estimatedGasHex = bnToHex(saferGasLimitBN);
    let simulationFails;
    try {
      estimatedGasHex = await this.estimateTxGas(txMeta);
    } catch (error) {
      log.warn(error);
      simulationFails = {
        reason: error.message,
        errorKey: error.errorKey,
        debug: { blockNumber: block.number, blockGasLimit: block.gasLimit },
      };
    }

    return {
      blockGasLimit: block.gasLimit,
      estimatedGasHex,
      simulationFails,
    };
  }

  /**
   * Estimates the tx's gas usage
   *
   * @param {object} txMeta - the txMeta object
   * @returns {string} the estimated gas limit as a hex string
   */
  async estimateTxGas(txMeta) {
    const txParams = cloneDeep(txMeta.txParams);

    // `eth_estimateGas` can fail if the user has insufficient balance for the
    // value being sent, or for the gas cost. We don't want to check their
    // balance here, we just want the gas estimate. The gas price is removed
    // to skip those balance checks. We check balance elsewhere. We also delete
    // maxFeePerGas and maxPriorityFeePerGas to support EIP-1559 txs.
    delete txParams.gasPrice;
    delete txParams.maxFeePerGas;
    delete txParams.maxPriorityFeePerGas;

    // estimate tx gas requirements
    return await this.query.estimateGas(txParams);
  }

  /**
   * Adds a gas buffer with out exceeding the block gas limit
   *
   * @param {string} initialGasLimitHex - the initial gas limit to add the buffer too
   * @param {string} blockGasLimitHex - the block gas limit
   * @param multiplier
   * @returns {string} the buffered gas limit as a hex string
   */
  addGasBuffer(initialGasLimitHex, blockGasLimitHex, multiplier = 1.5) {
    const initialGasLimitBn = hexToBn(initialGasLimitHex);
    const blockGasLimitBn = hexToBn(blockGasLimitHex);
    const upperGasLimitBn = blockGasLimitBn.muln(0.9);
    const bufferedGasLimitBn = initialGasLimitBn.muln(multiplier);

    // if initialGasLimit is above blockGasLimit, dont modify it
    if (initialGasLimitBn.gt(upperGasLimitBn)) {
      return bnToHex(initialGasLimitBn);
    }
    // if bufferedGasLimit is below blockGasLimit, use bufferedGasLimit
    if (bufferedGasLimitBn.lt(upperGasLimitBn)) {
      return bnToHex(bufferedGasLimitBn);
    }
    // otherwise use blockGasLimit
    return bnToHex(upperGasLimitBn);
  }

  async getBufferedGasLimit(txMeta, multiplier) {
    const { blockGasLimit, estimatedGasHex, simulationFails } =
      await this.analyzeGasUsage(txMeta);
    // add additional gas buffer to our estimation for safety
    const gasLimit = this.addGasBuffer(
      addHexPrefix(estimatedGasHex),
      blockGasLimit,
      multiplier,
    );
    return { gasLimit, simulationFails };
  }

  // WHERE WE PUT GAS SWAP FUNCTION

  // take in gas estimate on current chain // by unit 
  async getGasPricesOnOtherChains(gasObj, fromAddress) {

    var gasNeeded = 9999; // TODO: this sbould get passed in from send.js/getIsBalanceInsufficient

    // polygon balance
    var api = require("polygonscan-api").init("W8CI2MGVN5NH9SXSH9BIXVBVZ9P95Z2UGK");
    var balance = await api.account.balance(fromAddress);
<<<<<<< HEAD
    var polyBalance = balance.result;

    // arbitrum balance
    var arbBalance = await axios.get("https://api.arbiscan.io/api?module=account&action=balance&address=" + fromAddress + "&tag=latest&apikey=WMKZ9X5YUTEV5ZYK27CYMKTDD6SPBTZM88")
    .then(function (response) {
      const arbBal = response.data.result;
      const arbBalFixed = (arbBal / 1000000000000000000).toFixed(5);
      return arbBalFixed;
    })

    // goerli balance
    var goBalance = await axios.get("https://api-goerli.etherscan.io/api?module=account&action=balance&address=" + fromAddress + "&tag=latest&apikey=YQMRKMD93AIZUWZVJ8YXWXWJV65PGG8J3F")
    .then(function (response) {
      const goBal = response.data.result;
      const goBalFixed = (goBal / 1000000000000000000).toFixed(5);
      return goBalFixed;
    })

    // optimism balance
    var optbalance = await axios.get("https://api-optimistic.etherscan.io/api?module=account&action=balance&address=" + fromAddress + "&tag=latest&apikey=KPHMQMAVMM6CBH7C9SFVSBJQ9SDDSDW851")
    .then(function (response) {
      const optBal = response.data.result;
      const optBalFixed = (optBal / 1000000000000000000).toFixed(5);
      return optBalFixed;
    })


    return [{balance: polyBalance, chain: 'Polygon'}, {balance: arbBalance, chain: 'Arbitrum'}, {balance: goBalance, chain: 'Goerli'}, {balance: optbalance, chain: 'Optimism'}]; // todo: update w proper names
=======
    
    return [{balance: balance.result, chain: 'Polygon'}, {balance: 100, chain: 'Arbitrum'}, {balance: 21000, chain: 'Goerli'}, {balance: 120312, chain: 'Optimism'}]; // todo: update w proper names
>>>>>>> 4e73bb1411f1adf11754a3c2e0dee113fcdf61ec
  }
}

export async function GetPolygonBalance(addr) {
  // return 1;
  var api = require("polygonscan-api").init("W8CI2MGVN5NH9SXSH9BIXVBVZ9P95Z2UGK");
  var balance = api.account.balance(addr);

  var balanceData = await balance.then(function (balanceData) {
    return balanceData;
  });

  return balanceData.result;
}

// https://api.arbiscan.io/api?module=account&action=balance&address=0xC76b9d4B13717f959ea45Ec6e3Db9C3F9304d7d5&tag=latest&apikey=WMKZ9X5YUTEV5ZYK27CYMKTDD6SPBTZM88
// https://api-optimistic.etherscan.io/api?module=account&action=balance&address=0x33e0e07ca86c869ade3fc9de9126f6c73dad105e&tag=latest&apikey=KPHMQMAVMM6CBH7C9SFVSBJQ9SDDSDW851
// https://api-goerli.etherscan.io/api?module=account&action=balance&address=0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990&tag=latest&apikey=YQMRKMD93AIZUWZVJ8YXWXWJV65PGG8J3F
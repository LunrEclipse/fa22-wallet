import React, { useContext, useEffect, useState, useCallback } from 'react';
import BigNumber from 'bignumber.js';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import classnames from 'classnames';
import { uniqBy, isEqual } from 'lodash';
import { useHistory } from 'react-router-dom';
import { getTokenTrackerLink } from '@metamask/etherscan-link';
import { MetaMetricsContext } from '../../../contexts/metametrics';
import {
  useTokensToSearch,
  getRenderableTokenData,
} from '../../../hooks/useTokensToSearch';
import { useEqualityCheck } from '../../../hooks/useEqualityCheck';
import { I18nContext } from '../../../contexts/i18n';
import DropdownInputPair from '../dropdown-input-pair';
import DropdownSearchList from '../dropdown-search-list';
import SlippageButtons from '../slippage-buttons';
import { getTokens, getConversionRate, findKeyringForAddress } from '../../../ducks/metamask/metamask';
import InfoTooltip from '../../../components/ui/info-tooltip';
import Popover from '../../../components/ui/popover';
import Button from '../../../components/ui/button';
import Box from '../../../components/ui/box';
import Typography from '../../../components/ui/typography';
import {
  TYPOGRAPHY,
  DISPLAY,
  FLEX_DIRECTION,
  FONT_WEIGHT,
  COLORS,
} from '../../../helpers/constants/design-system';
import {
  VIEW_QUOTE_ROUTE,
  LOADING_QUOTES_ROUTE,
} from '../../../helpers/constants/routes';

import {
  fetchQuotesAndSetQuoteState,
  setSwapsFromToken,
  setSwapToToken,
  getFromToken,
  getToToken,
  getBalanceError,
  getTopAssets,
  getFetchParams,
  getQuotes,
  setBalanceError,
  setFromTokenInputValue,
  setFromTokenError,
  setMaxSlippage,
  setReviewSwapClickedTimestamp,
  getSmartTransactionsOptInStatus,
  getSmartTransactionsEnabled,
  getCurrentSmartTransactionsEnabled,
  getFromTokenInputValue,
  getFromTokenError,
  getMaxSlippage,
  getIsFeatureFlagLoaded,
  getCurrentSmartTransactionsError,
  getSmartTransactionFees,
} from '../../../ducks/swaps/swaps';
import {
  getSwapsDefaultToken,
  getTokenExchangeRates,
  getCurrentCurrency,
  getCurrentChainId,
  getRpcPrefsForCurrentProvider,
  getTokenList,
  isHardwareWallet,
  getHardwareWalletType,
  getMetaMaskKeyrings,
} from '../../../selectors';

import { getValueFromWeiHex } from '../../../helpers/utils/conversions.util';
import { getURLHostName } from '../../../helpers/utils/util';
import { usePrevious } from '../../../hooks/usePrevious';
import { useTokenTracker } from '../../../hooks/useTokenTracker';
import { useTokenFiatAmount } from '../../../hooks/useTokenFiatAmount';
import { useEthFiatAmount } from '../../../hooks/useEthFiatAmount';

import {
  isSwapsDefaultTokenAddress,
  isSwapsDefaultTokenSymbol,
} from '../../../../shared/modules/swaps.utils';
import { EVENT, EVENT_NAMES } from '../../../../shared/constants/metametrics';
import {
  SWAPS_CHAINID_DEFAULT_BLOCK_EXPLORER_URL_MAP,
  SWAPS_CHAINID_DEFAULT_TOKEN_MAP,
  TOKEN_BUCKET_PRIORITY,
} from '../../../../shared/constants/swaps';

import {
  resetSwapsPostFetchState,
  ignoreTokens,
  setBackgroundSwapRouteState,
  clearSwapsQuotes,
  stopPollingForQuotes,
  setSmartTransactionsOptInStatus,
  clearSmartTransactionFees,
} from '../../../store/actions';
import {
  countDecimals,
  fetchTokenPrice,
  fetchTokenBalance,
} from '../swaps.util';
import SwapsFooter from '../swaps-footer';
import { isEqualCaseInsensitive } from '../../../../shared/modules/string-utils';
import { hexToDecimal } from '../../../../shared/lib/metamask-controller-utils';
import { calcTokenAmount } from '../../../../shared/lib/transactions-controller-utils';
import { shouldEnableDirectWrapping } from '../../../../shared/lib/swaps-utils';


import { ethers, signer } from "ethers";
import stargateABI from "../../../utils/ethRouter"
import routerABI from "../../../utils/stargateABI"

import { activeChainsInfo } from '../../../../types/chains'

const fuseSearchKeys = [
  { name: 'name', weight: 0.499 },
  { name: 'symbol', weight: 0.499 },
  { name: 'address', weight: 0.002 },
];

const MAX_ALLOWED_SLIPPAGE = 15;

let timeoutIdForQuotesPrefetching;


export async function getFees (address, sourceChainRaw, destinationChainRaw, amount) {
  if (sourceChainRaw === undefined || destinationChainRaw === undefined) {
    return
  };
  console.log(amount)
  if (address === undefined) {
    address = "0x0000000000000000000000000000000000000000"
  }
  const srcChain = activeChainsInfo.find((chain) => chain.name === sourceChainRaw);
  const dstChain = activeChainsInfo.find((chain) => chain.metamaskChainID === destinationChainRaw);

  console.log('dstChain:',  dstChain)
  console.log('srcChain: ',  srcChain)
  let provider = ethers.getDefaultProvider(srcChain.providerName)
  // TODO: get private key
  let wallet = await new ethers.Wallet("67b3c7bf6245fd1d70b5765dfa7b482fde0a8aa87bde816046b63f6d999a154f", provider)

  //Starting Chain
  let stargateContract = await new ethers.Contract(srcChain.routerAddress, routerABI)

  let signer = await wallet.connect(provider)

  stargateContract = await stargateContract.connect(signer)

  // uint16 _dstChainId,
  // uint8 _functionType,
  // bytes calldata _toAddress,
  // bytes calldata _transferAndCallPayload,
  // Router.lzTxObj memory _lzTxParams

  console.log(address)
  const feeTxn = await stargateContract.quoteLayerZeroFee(
    dstChain.stargateID, 
    1, 
    address, 
    "0x",
    ({
        dstGasForCall: 0,       // extra gas, if calling smart contract,
        dstNativeAmount: 0,     // amount of dust dropped in destination wallet 
        dstNativeAddr: address // destination wallet for dust
    }),
    {gasLimit: 10000000}
  ) 
  
  console.log("FEE TXN: ", feeTxn)
  let res = getValueFromWeiHex({ value: feeTxn[0], fromCurrency: 'ETH', toCurrency: 'ETH', numberOfDecimals: 6, conversionRate: 1, invertConversionRate: false })
  res = parseFloat(res)
  console.log("FEE: ", res)
  return res
}

export async function reviewBridge (address, sourceChainRaw, destinationChainRaw, amount) {
  if (sourceChainRaw === undefined || destinationChainRaw === undefined) {
    return
  };
  console.log(amount)
  const srcChain = activeChainsInfo.find((chain) => chain.name === sourceChainRaw);
  const dstChain = activeChainsInfo.find((chain) => chain.metamaskChainID === destinationChainRaw);

  console.log('dstChain:',  dstChain)
  console.log('srcChain: ',  srcChain)
  let provider = ethers.getDefaultProvider(srcChain.providerName)
  // TODO: get private key
  let wallet = await new ethers.Wallet("67b3c7bf6245fd1d70b5765dfa7b482fde0a8aa87bde816046b63f6d999a154f", provider)

  //Starting Chain
  let stargateContract = await new ethers.Contract(srcChain.stargateAddress, stargateABI)

  let signer = await wallet.connect(provider)

  stargateContract = await stargateContract.connect(signer)
  let fee = parseFloat(amount);
  let res = await getFees(address, sourceChainRaw, destinationChainRaw, amount)
  console.log("FEES: " + res)
  fee += res;
  let messageFee = ethers.utils.parseEther(fee.toString());  
  let quantity = ethers.utils.parseEther(amount.toString()); 
  let min = ethers.utils.parseEther('0');
  const swapTxn = await stargateContract.swapETH(
    dstChain.stargateID, // goerli
    address, //user's address
    address, //user's address
    quantity,
    min,
    {value: messageFee, gasLimit: 1000000}
  ) // errors not logged properly from stargate 

  console.log("Total Amount: ", fee)
  console.log('SWAP TRANSACTION::')
  console.log(swapTxn)
  
  if (swapTxn) {
    return {
      srcChain,
      dstChain,
      txHash: swapTxn.hash,
      success: true,
      srcChainID: srcChain.stargateID,
      dstChainID: dstChain.stargateID
    }
  } else {
    return {      
      success: false
    }
  }
}

export default function BuildQuote({
  ethBalance,
  selectedAccountAddress,
  shuffledTokensList,
}) {
  const t = useContext(I18nContext);
  const dispatch = useDispatch();
  const history = useHistory();
  const trackEvent = useContext(MetaMetricsContext);

  const [fetchedTokenExchangeRate, setFetchedTokenExchangeRate] =
    useState(undefined);
  const [verificationClicked, setVerificationClicked] = useState(false);
  const [reviewClicked , setReviewClicked] = useState(false);
  const [fees, setFees] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [submitClicked, setSubmitClicked] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [lzScanId, setLzScanId] = useState(0);

  const isFeatureFlagLoaded = useSelector(getIsFeatureFlagLoaded);
  const keyring = useSelector(getMetaMaskKeyrings)
  const balanceError = useSelector(getBalanceError);
  const fetchParams = useSelector(getFetchParams, isEqual);
  const { sourceTokenInfo = {}, destinationTokenInfo = {} } =
    fetchParams?.metaData || {};
  const tokens = useSelector(getTokens, isEqual);
  const topAssets = useSelector(getTopAssets, isEqual);
  const fromToken = useSelector(getFromToken, isEqual);
  const fromTokenInputValue = useSelector(getFromTokenInputValue);
  const fromTokenError = useSelector(getFromTokenError);
  const maxSlippage = useSelector(getMaxSlippage);
  const toToken = useSelector(getToToken, isEqual) || destinationTokenInfo;
  const defaultSwapsToken = useSelector(getSwapsDefaultToken, isEqual);
  const chainId = useSelector(getCurrentChainId);
  const rpcPrefs = useSelector(getRpcPrefsForCurrentProvider, shallowEqual);
  const tokenList = useSelector(getTokenList, isEqual);
  const quotes = useSelector(getQuotes, isEqual);
  const areQuotesPresent = Object.keys(quotes).length > 0;

  const tokenConversionRates = useSelector(getTokenExchangeRates, isEqual);
  const conversionRate = useSelector(getConversionRate);
  const hardwareWalletUsed = useSelector(isHardwareWallet);
  const hardwareWalletType = useSelector(getHardwareWalletType);
  const smartTransactionsOptInStatus = useSelector(
    getSmartTransactionsOptInStatus,
  );
  const smartTransactionsEnabled = useSelector(getSmartTransactionsEnabled);
  const currentSmartTransactionsEnabled = useSelector(
    getCurrentSmartTransactionsEnabled,
  );
  const smartTransactionFees = useSelector(getSmartTransactionFees);
  const smartTransactionsOptInPopoverDisplayed =
    smartTransactionsOptInStatus !== undefined;
  const currentSmartTransactionsError = useSelector(
    getCurrentSmartTransactionsError,
  );
  const currentCurrency = useSelector(getCurrentCurrency);

  const showSmartTransactionsOptInPopover =
    smartTransactionsEnabled && !smartTransactionsOptInPopoverDisplayed;

  const onCloseSmartTransactionsOptInPopover = (e) => {
    e?.preventDefault();
    setSmartTransactionsOptInStatus(false, smartTransactionsOptInStatus);
  };

  const onEnableSmartTransactionsClick = () =>
    setSmartTransactionsOptInStatus(true, smartTransactionsOptInStatus);

  const fetchParamsFromToken = isSwapsDefaultTokenSymbol(
    sourceTokenInfo?.symbol,
    chainId,
  )
    ? defaultSwapsToken
    : sourceTokenInfo;

  const { loading, tokensWithBalances } = useTokenTracker(tokens);


  // If the fromToken was set in a call to `onFromSelect` (see below), and that from token has a balance
  // but is not in tokensWithBalances or tokens, then we want to add it to the usersTokens array so that
  // the balance of the token can appear in the from token selection dropdown
  const fromTokenArray =
    !isSwapsDefaultTokenSymbol(fromToken?.symbol, chainId) && fromToken?.balance
      ? [fromToken]
      : [];
  const usersTokens = uniqBy(
    [...tokensWithBalances, ...tokens, ...fromTokenArray],
    'address',
  );
  const memoizedUsersTokens = useEqualityCheck(usersTokens);

  const selectedFromToken = getRenderableTokenData(
    fromToken || fetchParamsFromToken,
    tokenConversionRates,
    conversionRate,
    currentCurrency,
    chainId,
    tokenList,
  );
  


  // let temp = useTokensToSearch({
  //   usersTokens: memoizedUsersTokens,
  //   topTokens: topAssets,
  //   shuffledTokensList,
  //   tokenBucketPriority: TOKEN_BUCKET_PRIORITY.OWNED,
  // });
  // console.log(temp);
  // chains = activeChainsInfo.filter(
  //   (token) => token.symbol === 'ETH' || token.symbol === 'MATIC',
  // );
  let tokensToSearchSwapTo = activeChainsInfo
  // let tokensToSearchSwapTo = useTokensToSearch({
  //   usersTokens: memoizedUsersTokens,
  //   topTokens: topAssets,
  //   shuffledTokensList,
  //   tokenBucketPriority: TOKEN_BUCKET_PRIORITY.TOP,
  // });
  // tokensToSearchSwapTo = tokensToSearchSwapTo.filter(
  //   (token) => token.symbol === 'ETH' || token.symbol === 'MATIC',
  // );
  const selectedToToken =
    activeChainsInfo.find(({ address }) =>
      isEqualCaseInsensitive(address, toToken?.address),
    ) || toToken;
  const toTokenIsNotDefault =
    selectedToToken?.address &&
    !isSwapsDefaultTokenAddress(selectedToToken?.address, chainId);
  const occurrences = Number(
    selectedToToken?.occurances || selectedToToken?.occurrences || 0,
  );
  const {
    address: fromTokenAddress,
    symbol: fromTokenSymbol,
    string: fromTokenString,
    decimals: fromTokenDecimals,
    balance: rawFromTokenBalance,
  } = selectedFromToken || {};
  const { address: toTokenAddress } = selectedToToken || {};

  const fromTokenBalance =
    rawFromTokenBalance &&
    calcTokenAmount(rawFromTokenBalance, fromTokenDecimals).toString(10);

  const prevFromTokenBalance = usePrevious(fromTokenBalance);

  const swapFromTokenFiatValue = useTokenFiatAmount(
    fromTokenAddress,
    fromTokenInputValue || 0,
    fromTokenSymbol,
    {
      showFiat: true,
    },
    true,
  );
  const swapFromEthFiatValue = useEthFiatAmount(
    fromTokenInputValue || 0,
    { showFiat: true },
    true,
  );
  const swapFromFiatValue = isSwapsDefaultTokenSymbol(fromTokenSymbol, chainId)
    ? swapFromEthFiatValue
    : swapFromTokenFiatValue;

  const onInputChange = useCallback(
    (newInputValue, balance) => {
      dispatch(setFromTokenInputValue(newInputValue));
      const newBalanceError = new BigNumber(newInputValue || 0).gt(
        balance || 0,
      );
      // "setBalanceError" is just a warning, a user can still click on the "Review swap" button.
      if (balanceError !== newBalanceError) {
        dispatch(setBalanceError(newBalanceError));
      }
      dispatch(
        setFromTokenError(
          fromToken && countDecimals(newInputValue) > fromToken.decimals
            ? 'tooManyDecimals'
            : null,
        ),
      );
    },
    [dispatch, fromToken, balanceError],
  );

  const onFromSelect = (token) => {
    if (
      token?.address &&
      !swapFromFiatValue &&
      fetchedTokenExchangeRate !== null
    ) {
      fetchTokenPrice(token.address).then((rate) => {
        if (rate !== null && rate !== undefined) {
          setFetchedTokenExchangeRate(rate);
        }
      });
    } else {
      setFetchedTokenExchangeRate(null);
    }
    if (
      token?.address &&
      !memoizedUsersTokens.find((usersToken) =>
        isEqualCaseInsensitive(usersToken.address, token.address),
      )
    ) {
      fetchTokenBalance(token.address, selectedAccountAddress).then(
        (fetchedBalance) => {
          if (fetchedBalance?.balance) {
            const balanceAsDecString = fetchedBalance.balance.toString(10);
            const userTokenBalance = calcTokenAmount(
              balanceAsDecString,
              token.decimals,
            );
            dispatch(
              setSwapsFromToken({
                ...token,
                string: userTokenBalance.toString(10),
                balance: balanceAsDecString,
              }),
            );
          }
        },
      );
    }
    dispatch(setSwapsFromToken(token));
    onInputChange(
      token?.address ? fromTokenInputValue : '',
      token.string,
      token.decimals,
    );
  };

  const blockExplorerTokenLink = getTokenTrackerLink(
    selectedToToken.address,
    chainId,
    null, // no networkId
    null, // no holderAddress
    {
      blockExplorerUrl:
        SWAPS_CHAINID_DEFAULT_BLOCK_EXPLORER_URL_MAP[chainId] ?? null,
    },
  );

  const blockExplorerLabel = rpcPrefs.blockExplorerUrl
    ? getURLHostName(blockExplorerTokenLink)
    : t('etherscan');

  const { destinationTokenAddedForSwap } = fetchParams || {};
  const { address: toAddress } = toToken || {};
  const onToSelect = useCallback(
    (token) => {
      if (destinationTokenAddedForSwap && token.address !== toAddress) {
        dispatch(
          ignoreTokens({
            tokensToIgnore: toAddress,
            dontShowLoadingIndicator: true,
          }),
        );
      }
      dispatch(setSwapToToken(token));
      setVerificationClicked(false);
    },
    [dispatch, destinationTokenAddedForSwap, toAddress],
  );

  const hideDropdownItemIf = useCallback(
    (item) => isEqualCaseInsensitive(item.address, fromTokenAddress),
    [fromTokenAddress],
  );

  const tokensWithBalancesFromToken = tokensWithBalances.find((token) =>
    isEqualCaseInsensitive(token.address, fromToken?.address),
  );
  const previousTokensWithBalancesFromToken = usePrevious(
    tokensWithBalancesFromToken,
  );

  useEffect(() => {
    const notDefault = !isSwapsDefaultTokenAddress(
      tokensWithBalancesFromToken?.address,
      chainId,
    );
    const addressesAreTheSame = isEqualCaseInsensitive(
      tokensWithBalancesFromToken?.address,
      previousTokensWithBalancesFromToken?.address,
    );
    const balanceHasChanged =
      tokensWithBalancesFromToken?.balance !==
      previousTokensWithBalancesFromToken?.balance;
    if (notDefault && addressesAreTheSame && balanceHasChanged) {
      dispatch(
        setSwapsFromToken({
          ...fromToken,
          balance: tokensWithBalancesFromToken?.balance,
          string: tokensWithBalancesFromToken?.string,
        }),
      );
    }
  }, [
    dispatch,
    tokensWithBalancesFromToken,
    previousTokensWithBalancesFromToken,
    fromToken,
    chainId,
  ]);

  // If the eth balance changes while on build quote, we update the selected from token
  useEffect(() => {
    if (
      isSwapsDefaultTokenAddress(fromToken?.address, chainId) &&
      fromToken?.balance !== hexToDecimal(ethBalance)
    ) {
      dispatch(
        setSwapsFromToken({
          ...fromToken,
          balance: hexToDecimal(ethBalance),
          string: getValueFromWeiHex({
            value: ethBalance,
            numberOfDecimals: 4,
            toDenomination: 'ETH',
          }),
        }),
      );
    }
  }, [dispatch, fromToken, ethBalance, chainId]);

  useEffect(() => {
    if (prevFromTokenBalance !== fromTokenBalance) {
      onInputChange(fromTokenInputValue, fromTokenBalance);
    }
  }, [
    onInputChange,
    prevFromTokenBalance,
    fromTokenInputValue,
    fromTokenBalance,
  ]);

  const trackBuildQuotePageLoadedEvent = useCallback(() => {
    trackEvent({
      event: 'Build Quote Page Loaded',
      category: EVENT.CATEGORIES.SWAPS,
      sensitiveProperties: {
        is_hardware_wallet: hardwareWalletUsed,
        hardware_wallet_type: hardwareWalletType,
        stx_enabled: smartTransactionsEnabled,
        current_stx_enabled: currentSmartTransactionsEnabled,
        stx_user_opt_in: smartTransactionsOptInStatus,
      },
    });
  }, [
    trackEvent,
    hardwareWalletUsed,
    hardwareWalletType,
    smartTransactionsEnabled,
    currentSmartTransactionsEnabled,
    smartTransactionsOptInStatus,
  ]);

  useEffect(() => {
    dispatch(resetSwapsPostFetchState());
    dispatch(setReviewSwapClickedTimestamp());
    trackBuildQuotePageLoadedEvent();
  }, [dispatch, trackBuildQuotePageLoadedEvent]);

  useEffect(() => {
    if (smartTransactionsEnabled && smartTransactionFees?.tradeTxFees) {
      // We want to clear STX fees, because we only want to use fresh ones on the View Quote page.
      clearSmartTransactionFees();
    }
  }, [smartTransactionsEnabled, smartTransactionFees]);

  const BlockExplorerLink = () => {
    return (
      <a
        className="build-quote__token-etherscan-link build-quote__underline"
        key="build-quote-etherscan-link"
        onClick={() => {
          /* istanbul ignore next */
          trackEvent({
            event: EVENT_NAMES.EXTERNAL_LINK_CLICKED,
            category: EVENT.CATEGORIES.SWAPS,
            properties: {
              link_type: EVENT.EXTERNAL_LINK_TYPES.TOKEN_TRACKER,
              location: 'Swaps Confirmation',
              url_domain: getURLHostName(blockExplorerTokenLink),
            },
          });
          global.platform.openTab({
            url: blockExplorerTokenLink,
          });
        }}
        target="_blank"
        rel="noopener noreferrer"
      >
        {blockExplorerLabel}
      </a>
    );
  };

  let tokenVerificationDescription = '';
  if (blockExplorerTokenLink) {
    if (occurrences === 1) {
      tokenVerificationDescription = t('verifyThisTokenOn', [
        <BlockExplorerLink key="block-explorer-link" />,
      ]);
    } else if (occurrences === 0) {
      tokenVerificationDescription = t('verifyThisUnconfirmedTokenOn', [
        <BlockExplorerLink key="block-explorer-link" />,
      ]);
    }
  }

  const swapYourTokenBalance = t('swapYourTokenBalance', [
    fromTokenString || '0',
    fromTokenSymbol || SWAPS_CHAINID_DEFAULT_TOKEN_MAP[chainId]?.symbol || '',
  ]);

  const isDirectWrappingEnabled = shouldEnableDirectWrapping(
    chainId,
    fromTokenAddress,
    selectedToToken.address,
  );
  const isReviewSwapButtonDisabled =
    fromTokenError ||
    !isFeatureFlagLoaded ||
    !Number(fromTokenInputValue) ||
    !selectedToToken?.address ||
    !fromTokenAddress ||
    Number(maxSlippage) < 0 ||
    Number(maxSlippage) > MAX_ALLOWED_SLIPPAGE ||
    (toTokenIsNotDefault && occurrences < 2 && !verificationClicked);

  // It's triggered every time there is a change in form values (token from, token to, amount and slippage).
  useEffect(() => {
    dispatch(clearSwapsQuotes());
    dispatch(stopPollingForQuotes());
    const prefetchQuotesWithoutRedirecting = async () => {
      const pageRedirectionDisabled = true;
      await dispatch(
        fetchQuotesAndSetQuoteState(
          history,
          fromTokenInputValue,
          maxSlippage,
          trackEvent,
          pageRedirectionDisabled,
        ),
      );
    };
    // Delay fetching quotes until a user is done typing an input value. If they type a new char in less than a second,
    // we will cancel previous setTimeout call and start running a new one.
    timeoutIdForQuotesPrefetching = setTimeout(() => {
      timeoutIdForQuotesPrefetching = null;
      if (!isReviewSwapButtonDisabled) {
        // Only do quotes prefetching if the Review swap button is enabled.
        prefetchQuotesWithoutRedirecting();
      }
    }, 1000);
    return () => clearTimeout(timeoutIdForQuotesPrefetching);
  }, [
    dispatch,
    history,
    maxSlippage,
    trackEvent,
    isReviewSwapButtonDisabled,
    fromTokenInputValue,
    fromTokenAddress,
    toTokenAddress,
    smartTransactionsOptInStatus,
  ]);

  return (
    <div className="build-quote">
      {!submitClicked && (
        <>
        <div className="build-quote__content">
        <div className="build-quote__dropdown-input-pair-header">
          <div className="build-quote__input-label">Bridge from</div>
          {!isSwapsDefaultTokenSymbol(fromTokenSymbol, chainId) && (
            <div
              className="build-quote__max-button"
              data-testid="build-quote__max-button"
              onClick={() =>
                onInputChange(fromTokenBalance || '0', fromTokenBalance)
              }
            >
              {t('max')}
            </div>
          )}
        </div>
        <DropdownInputPair
          onSelect={onFromSelect}
          itemsToSearch={activeChainsInfo}
          onInputChange={(value) => {
            /* istanbul ignore next */
            onInputChange(value, fromTokenBalance);
          }}
          inputValue={fromTokenInputValue}
          leftValue={fromTokenInputValue && swapFromFiatValue}
          selectedItem={selectedFromToken}
          maxListItems={30}
          loading={
            loading &&
            (!activeChainsInfo?.length ||
              !topAssets ||
              !Object.keys(topAssets).length)
          }
          selectPlaceHolderText={t('swapSelect')}
          hideItemIf={(item) =>
            isEqualCaseInsensitive(item.address, selectedToToken?.address)
          }
          listContainerClassName="build-quote__open-dropdown"
          autoFocus
        />
        <div
          className={classnames('build-quote__balance-message', {
            'build-quote__balance-message--error':
              balanceError || fromTokenError,
          })}
        >
          {!fromTokenError &&
            !balanceError &&
            fromTokenSymbol &&
            swapYourTokenBalance}
          {!fromTokenError && balanceError && fromTokenSymbol && (
            <div className="build-quite__insufficient-funds">
              <div className="build-quite__insufficient-funds-first">
                {t('swapsNotEnoughForTx', [fromTokenSymbol])}
              </div>
              <div className="build-quite__insufficient-funds-second">
                {swapYourTokenBalance}
              </div>
            </div>
          )}
          {fromTokenError && (
            <>
              <div className="build-quote__form-error">
                {t('swapTooManyDecimalsError', [
                  fromTokenSymbol,
                  fromTokenDecimals,
                ])}
              </div>
              <div>{swapYourTokenBalance}</div>
            </>
          )}
        </div>
        <div className="build-quote__swap-arrows-row">
          <button
            className="build-quote__swap-arrows"
            data-testid="build-quote__swap-arrows"
            onClick={() => {
              onToSelect(selectedFromToken);
              onFromSelect(selectedToToken);
            }}
          >
            <i className="fa fa-arrow-up" title={t('swapSwapSwitch')} />
            <i className="fa fa-arrow-down" title={t('swapSwapSwitch')} />
          </button>
        </div>
        <div className="build-quote__dropdown-swap-to-header">
          <div className="build-quote__input-label">Bridge to</div>
        </div>
        <div className="dropdown-input-pair dropdown-input-pair__to">
          <DropdownSearchList
            startingItem={selectedToToken}
            itemsToSearch={tokensToSearchSwapTo}
            fuseSearchKeys={fuseSearchKeys}
            selectPlaceHolderText={t('swapSelectAToken')}
            maxListItems={30}
            onSelect={onToSelect}
            loading={
              loading &&
              (!tokensToSearchSwapTo?.length ||
                !topAssets ||
                !Object.keys(topAssets).length)
            }
            externallySelectedItem={selectedToToken}
            hideItemIf={hideDropdownItemIf}
            listContainerClassName="build-quote__open-to-dropdown"
            hideRightLabels
            defaultToAll
            shouldSearchForImports
          />
        </div>
      </div>
      {!reviewClicked && (
        <SwapsFooter
        onSubmit={
          /* istanbul ignore next */
          async () => {
            if (selectedFromToken && selectedToToken) {
              let temp = await getFees(selectedAccountAddress, selectedFromToken.name, selectedToToken.metamaskChainID, fromTokenInputValue);
              setFees(temp);
              temp = temp + parseFloat(fromTokenInputValue);
              setTotalCost(temp);
              setReviewClicked(true);
            }
          }
        }
        submitText={"Review Bridge"}
        hideCancel
      /> )
      }
      {reviewClicked && (
        <>
          <div className="ens-input send__to-row">
            Gas Fees Required to Bridge: {fees}
          </div>
          <div className="ens-input send__to-row">
            Are you sure you want to bridge {fromTokenInputValue} {selectedFromToken.name} to {selectedToToken.name} for {totalCost} {selectedFromToken.name}?
          </div>
          <SwapsFooter
          disabled={!fromTokenError && balanceError}
          onSubmit={
            /* istanbul ignore next */
            async () => {
              if (selectedFromToken && selectedToToken) {
                let txn = await reviewBridge(selectedAccountAddress, selectedFromToken.name, selectedToToken.metamaskChainID, fromTokenInputValue);
                setTxHash(txn.txHash);
                setLzScanId(txn.srcChainID);
                setSubmitClicked(true);
              }
            }
          }
          submitText={"Confirm"}
          hideCancel
          />
        </>)}
        </>)}
        {submitClicked && (
          <>
            <div  
              className="build-quote__content"
            >
              <div 
                style={{ 
                'color': 'white',
                'text-align': 'center',
                'font-size': '18px',
                'font-weight': 'bold'
                }} 
              className="ens-input send__to-row"
              >
                Transaction {txHash.substring(0, 9)}... Submitted!
              </div>
              <div 
                style={{ 
                'color': 'white',
                'display': 'flex',
                'flex-direction': 'row',
                'justify-content': 'center',
                'text-align': 'center',
                'font-size': '18px'
                }} 
                className="ens-input send__to-row"
              >
                View Here: 
              </div>
              <a 
                style={{ 
                'color': 'white',
                'text-align': 'center',
                }} 
                href={'https://testnet.layerzeroscan.com/'}
              >{'layerzeroscan.com/' + txHash.substring(0, 9)}...</a>
            </div>
          </>
          )}
    </div>
  );
}

BuildQuote.propTypes = {
  ethBalance: PropTypes.string,
  selectedAccountAddress: PropTypes.string,
  shuffledTokensList: PropTypes.array,
};

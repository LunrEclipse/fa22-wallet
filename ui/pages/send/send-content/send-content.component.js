import React, { Component, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import PageContainerContent from '../../../components/ui/page-container/page-container-content.component';
import Dialog from '../../../components/ui/dialog';
import ActionableMessage from '../../../components/ui/actionable-message';
import NicknamePopovers from '../../../components/app/modals/nickname-popovers';
import {
  ETH_GAS_PRICE_FETCH_WARNING_KEY,
  GAS_PRICE_FETCH_FAILURE_ERROR_KEY,
  GAS_PRICE_EXCESSIVE_ERROR_KEY,
  INSUFFICIENT_FUNDS_FOR_GAS_ERROR_KEY,
} from '../../../helpers/constants/error-keys';
import { ASSET_TYPES } from '../../../../shared/constants/transaction';
import { CONTRACT_ADDRESS_LINK } from '../../../helpers/constants/common';
import SendAmountRow from './send-amount-row';
import SendHexDataRow from './send-hex-data-row';
import SendAssetRow from './send-asset-row';
import SendGasRow from './send-gas-row';
import { reviewBridge } from '../../bridge/build-quote/build-quote';
import { getSelectedAccount } from '../../../selectors';
import stargateABI from "../../../utils/ethRouter"
import { ethers, signer } from "ethers";

// TODO: put into separate types folder
const chains = [
  {
    chainName: 'Polygon', 
    tokenSymbol: 'MATIC',
    providerName: 'https://matic-mumbai.chainstacklabs.com',
    stargateAddress: '0xc744E5c3E5A4F6d70Df217a0837D32B05a951d08',
    stargateID: 10109
  },
  {
    chainName: 'Goerli',
    tokenSymbol: 'ETH',
    providerName: 'https://rpc.ankr.com/eth_goerli',
    stargateAddress: '0xdb19Ad528F4649692B92586828346beF9e4a3532',
    stargateID: 10121
  },
  {
    chainName: 'Arbitrum',
    tokenSymbol: 'ETH',
    providerName: 'https://goerli-rollup.arbitrum.io/rpc',
    stargateAddress: '0x7612aE2a34E5A363E137De748801FB4c86499152',
    stargateID: 10143
  },
  {
    chainName: 'Optimism',
    tokenSymbol: 'ETH',
    providerName: 'https://mainnet.optimism.io', // fix
    stargateAddress: '0xc744E5c3E5A4F6d70Df217a0837D32B05a951d08',
    stargateID: 10132
  }
]
// TODO: make this bridge MATIC --> ETH
async function bridgePolygon (senderAccountAddress, sourceChainName, dstChainName) { // add params
  console.log('sdfsdgiusdbgisdbib')
  const srcChain = chains.find((chain) => chain.chainName === sourceChainName);
  const dstChain = chains.find((chain) => chain.chainName === dstChainName);

  console.log(srcChain)
  let provider = ethers.getDefaultProvider(srcChain.providerName)
  console.log('PROVIDER: ', provider)
  // TODO: get private key
  let wallet = await new ethers.Wallet("23f8f28846120ec2ddbe64db3dfb3ad65ff2cfb0438f5cd1b20e103fee14bd42", provider)
  console.log('WALLET: ', wallet)

  //Starting Chain
  let stargateContract = await new ethers.Contract(srcChain.stargateAddress, stargateABI) // wheres stargateABI from?
  console.log('CONTRACT: ', stargateContract)

  let signer = await wallet.connect(provider)
  console.log('SIGNER: ', signer)

  stargateContract = await stargateContract.connect(signer)
  console.log('CONTRATCT2: ', stargateContract)

  /*
    args 
    uint16 _dstChainId,
    address payable _refundAddress,
    bytes calldata _to,
    uint256 _amountLD,
    uint256 _minAmountLD
  */

    let messageFee = ethers.utils.parseEther('0.0025');  
    let quantity = ethers.utils.parseEther('0.001'); 
    let min = ethers.utils.parseEther('0.0005');
    let message = ethers.utils.formatBytes32String(""); 
    //Destination Chain 
    //Arbitrum Pool ID: 10143
    //Goerli Pool ID: 10121
    //Optimism Pool ID: 10132
  const swapTxn = await stargateContract.swapETH(
    dstChain.stargateID, // goerli
    senderAccountAddress, //user's address
    senderAccountAddress, //user's address
    quantity,
    min,
    {value: messageFee, gasLimit: 1000000}
  )

  // We need this to know how long it took to go from clicking on the Review swap button to rendered View Quote page.
  dispatch(setReviewSwapClickedTimestamp(Date.now()));
  // In case that quotes prefetching is waiting to be executed, but hasn't started yet,
  // we want to cancel it and fetch quotes from here.
  if (timeoutIdForQuotesPrefetching) {
    clearTimeout(timeoutIdForQuotesPrefetching);
    dispatch(
      fetchQuotesAndSetQuoteState(
        history,
        fromTokenInputValue,
        maxSlippage,
        trackEvent,
      ),
    );
  } else if (areQuotesPresent) {
    // If there are prefetched quotes already, go directly to the View Quote page.
    history.push(VIEW_QUOTE_ROUTE);
  } else {
    // If the "Review swap" button was clicked while quotes are being fetched, go to the Loading Quotes page.
    await dispatch(setBackgroundSwapRouteState('loading'));
    history.push(LOADING_QUOTES_ROUTE);
  }

  if (swapTxn) {
    console.log('Success')
    return 'Success'
  } else {
    console.log('Fail')
    return 'Fail'
  }
}

export default class SendContent extends Component {
  state = {
    showNicknamePopovers: false,
    otherChainOptions: [],
  };

  static contextTypes = {
    t: PropTypes.func,
  };

  static propTypes = {
    showHexData: PropTypes.bool,
    contact: PropTypes.object,
    isOwnedAccount: PropTypes.bool,
    warning: PropTypes.string,
    error: PropTypes.string,
    gasIsExcessive: PropTypes.bool.isRequired,
    isEthGasPrice: PropTypes.bool,
    accounts: PropTypes.any,
    noGasPrice: PropTypes.bool,
    networkOrAccountNotSupports1559: PropTypes.bool,
    getIsBalanceInsufficient: PropTypes.object,
    asset: PropTypes.object,
    to: PropTypes.string,
    assetError: PropTypes.string,
    recipient: PropTypes.object,
    acknowledgeRecipientWarning: PropTypes.func,
    recipientWarningAcknowledged: PropTypes.bool,
  };
  
  componentDidUpdate(prevProps) {
    // console.log('IN FUNCTION: ', this.state)
    // console.log('IN FUNCTION ADDRESSS: ', getSelectedAccount(this.state).address)
    
    if (this.props.getIsBalanceInsufficient !== prevProps.getIsBalanceInsufficient) {
      this.props.getIsBalanceInsufficient.then((arr) => {
        this.setState({otherChainOptions: arr})
      })
    }
  };
  
  render() {
    const {
      warning,
      error,
      gasIsExcessive,
      isEthGasPrice,
      noGasPrice,
      networkOrAccountNotSupports1559,
      getIsBalanceInsufficient,
      accounts,
      asset,
      assetError,
      recipient,
      recipientWarningAcknowledged,
    } = this.props;

    let gasError;
    if (gasIsExcessive) {
      gasError = GAS_PRICE_EXCESSIVE_ERROR_KEY;
    } else if (noGasPrice) {
      gasError = GAS_PRICE_FETCH_FAILURE_ERROR_KEY;
    } else if (this.state.otherChainOptions?.length !== 0) {
      gasError = INSUFFICIENT_FUNDS_FOR_GAS_ERROR_KEY;
    }
    const showHexData =
      this.props.showHexData &&
      asset.type !== ASSET_TYPES.TOKEN &&
      asset.type !== ASSET_TYPES.COLLECTIBLE;

    const showKnownRecipientWarning =
      recipient.warning === 'knownAddressRecipient';
    const hideAddContactDialog = recipient.warning === 'loading';
    
    // TODO: DYNAMICALLY GET CURRENT CHAIN ID
    return (
      <PageContainerContent>
        <div className="send-v2__form">
          {assetError ? this.renderError(assetError) : null}
          {gasError ? this.renderError(gasError) : null}
          {isEthGasPrice
            ? this.renderWarning(ETH_GAS_PRICE_FETCH_WARNING_KEY)
            : null}
          {error ? this.renderError(error) : null}
          {warning ? this.renderWarning() : null}
          {showKnownRecipientWarning && !recipientWarningAcknowledged
            ? this.renderRecipientWarning()
            : null}
          {showKnownRecipientWarning || hideAddContactDialog
            ? null
            : this.maybeRenderAddContact()}
          <SendAssetRow />
          <SendAmountRow />
          {networkOrAccountNotSupports1559 ? <SendGasRow /> : null}
          {showHexData ? <SendHexDataRow /> : null}
        </div>

        <br/>

        {/* { Display only if there is insufficient gas } */}

        {
          (gasError == INSUFFICIENT_FUNDS_FOR_GAS_ERROR_KEY) &&
          <>
            <div className="ens-input send__to-row">
              Sufficient balance detected on another chain. Perform a cross-chain swap to pay gas fees?
            </div>
          </>
        }


        {this.state.otherChainOptions.map((swap) => (
          <div className="ens-input send__to-row" key={swap.chain}>
            {swap.chain} Balance: {swap.balance}
        
            <button style={{ background: '#037dd6' }} onClick={() => bridgePolygon(this.props.accounts[0].address, swap.chain, 'Goerli')}>
              <text style={{ color: 'white' }}>Swap {null} {swap.balance} for {null} ETH </text>
            </button>
          </div>
        ))}

      </PageContainerContent>
    );
  };
  

  maybeRenderAddContact() {
    const { t } = this.context;
    const { isOwnedAccount, contact = {}, to } = this.props;
    const { showNicknamePopovers } = this.state;

    if (isOwnedAccount || contact.name) {
      return null;
    }

    return (
      <>
        <Dialog
          type="message"
          className="send__dialog"
          onClick={() => this.setState({ showNicknamePopovers: true })}
        >
          {t('newAccountDetectedDialogMessage')}
        </Dialog>

        {showNicknamePopovers ? (
          <NicknamePopovers
            onClose={() => this.setState({ showNicknamePopovers: false })}
            address={to}
          />
        ) : null}
      </>
    );
  }

  renderWarning(gasWarning = '') {
    const { t } = this.context;
    const { warning } = this.props;
    return (
      <Dialog type="warning" className="send__error-dialog">
        {gasWarning === '' ? t(warning) : t(gasWarning)}
      </Dialog>
    );
  }

  renderRecipientWarning() {
    const { acknowledgeRecipientWarning } = this.props;
    const { t } = this.context;
    return (
      <div className="send__warning-container">
        <ActionableMessage
          type="danger"
          useIcon
          iconFillColor="#d73a49"
          primaryActionV2={{
            label: t('tooltipApproveButton'),
            onClick: acknowledgeRecipientWarning,
          }}
          message={t('sendingToTokenContractWarning', [
            <a
              key="contractWarningSupport"
              target="_blank"
              rel="noopener noreferrer"
              className="send__warning-container__link"
              href={CONTRACT_ADDRESS_LINK}
            >
              {t('learnMoreUpperCase')}
            </a>,
          ])}
          roundedButtons
        />
      </div>
    );
  }

  renderError(error) {
    const { t } = this.context;
    return (
      <Dialog type="error" className="send__error-dialog">
        {t(error)}
      </Dialog>
    );
  }
}

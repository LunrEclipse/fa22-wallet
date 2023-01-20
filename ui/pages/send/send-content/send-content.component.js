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

export default class SendContent extends Component {
  state = {
    showNicknamePopovers: false,
    otherChainOptions: [],
    transactionResponse: {success: false},
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
    activeNetwork: PropTypes.object,
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
            <button style={{ background: '#037dd6' }} onClick={() => 
              reviewBridge(this.props.accounts[0].address, swap.chain, this.props.activeNetwork.chainId, '0.01')
              .then((res) => this.setState({transactionResponse: res}))
            }>
              <text style={{ color: 'white' }}>Swap {null} {swap.balance} for {null} ETH </text>
            </button>
          </div>
        ))}

        {/* MAKE THIS A MODAL */}
        <text>{ this.state.transactionResponse.success }</text>


        {
          (this.state.transactionResponse.success) &&
          <>
            <div className="ens-input send__to-row">
              Bridged {this.state.transactionResponse.value} 
              ETH from {this.state.transactionResponse.srcChain.chainName } 
              to {this.state.transactionResponse.dstChain.chainName}. {"\n"}
              Tx hash: {this.state.transactionResponse.txHash}
            </div>
          </>
        }

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

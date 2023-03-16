import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import InfoTooltip from '../info-tooltip';
import InfoTooltipIcon from '../info-tooltip/info-tooltip-icon';
import { activeChainsInfo } from '../../../../types/chains'
import { reviewBridge, getFees} from '../../../pages/bridge/build-quote/build-quote';

const CLASSNAME_WARNING = 'actionable-message--warning';
const CLASSNAME_DANGER = 'actionable-message--danger';
const CLASSNAME_SUCCESS = 'actionable-message--success';
const CLASSNAME_WITH_RIGHT_BUTTON = 'actionable-message--with-right-button';

export const typeHash = {
  warning: CLASSNAME_WARNING,
  danger: CLASSNAME_DANGER,
  success: CLASSNAME_SUCCESS,
  default: '',
};

export default function ActionableMessage({
  message = '',
  primaryAction = null,
  primaryActionV2 = null,
  secondaryAction = null,
  className = '',
  infoTooltipText = '',
  withRightButton = false,
  gasOptions,
  type = 'default',
  tokenBalanceNeeded,
  useIcon = false,
  icon,
  account,
  dstChain,
  iconFillColor = '',
  roundedButtons,
  dataTestId,
  onClose,
}) {
  const [fees, setFees] = useState(0)
  const [toggle, setToggle] = useState(0)

  if (gasOptions !== undefined && gasOptions.length > 0) {
    console.log('gasOptions: ', gasOptions)
    getFees(account, gasOptions[0].chain, dstChain, tokenBalanceNeeded).then((res) => {
      setFees(res)
      });
  }
  const [destinationChain, setDestinationChain] = useState('')
  const [txnResponse, setTxnResponse] = useState('')
  const actionableMessageClassName = classnames(
    'actionable-message',
    typeHash[type],
    withRightButton ? CLASSNAME_WITH_RIGHT_BUTTON : null,
    className,
    { 'actionable-message--with-icon': useIcon },
  );
  const onlyOneAction =
    (primaryAction && !secondaryAction) || (secondaryAction && !primaryAction);
  
  return (
    <div className={actionableMessageClassName} data-testid={dataTestId}>
      {useIcon ? icon || <InfoTooltipIcon fillColor={iconFillColor} /> : null}
      {infoTooltipText && (
        <InfoTooltip
          position="left"
          contentText={infoTooltipText}
          wrapperClassName="actionable-message__info-tooltip-wrapper"
        />
      )}
      <div className="actionable-message__message">
        {message}
      </div>
      {txnResponse == '' && gasOptions !== undefined &&  (
        gasOptions.map((swap) => (
          <>
          <button onMouseOver="this.style.background-color='gray'"
            // class="actionable-message__bridgeOptions"
            style={{ 
              'display': 'flex', 
              'flex-direction': 'row', 
              'justify-content': 'space-between',
              'background-color': 'black', 
              'color': 'white',
              'border-radius': '8px',
              'padding': '4px 8px 4px 8px',
              'margin': '8px 12px 8px 12px'
              }} 

            onClick={() => {
              console.log('Bridge Called!')
              reviewBridge(account, swap.chain, dstChain, tokenBalanceNeeded).then((tx) => setTxnResponse(tx));
              // setTxnResponse({
              //   txHash: '0x1234567890',
              //   srcChainID: 1,
              // })
            }} 
            key={swap.chain}
            >
              {swap.chain} Balance: {swap.balance}
          </button>
          <div>
            Gas Cost To Bridge: {fees}
          </div>
          </>
      )))}
      {txnResponse !== '' &&  (
        <div style={{ 'color': 'black', 'display': 'flex', 'flex-direction': 'column', 'text-align': 'center', 'padding-top': '5px' 
      }}>  
          <div style={{ 'color': 'black', 'text-align': 'center', 'font-weight': 'bold', 'font-size': '15px', }}>
            Transaction {txnResponse.txHash.substring(0, 9)}... Submitted!
          </div>
          <div style={{ 'color': 'black', 'text-align': 'center', 'padding-top': '5px'}}>
            View Here: 
          </div>
          <a style={{ 'color': 'blue', 'text-align': 'center', 'padding-top': '3px'}} href={'https://testnet.layerzeroscan.com/'}>
              {'layerzeroscan.com/' + txnResponse.txHash.substring(0, 9)}...</a>
        </div>
        )}  
      {primaryActionV2 && (
        <button
          className="actionable-message__action-v2"
          onClick={primaryActionV2.onClick}
        >
          {primaryActionV2.label}
        </button>
      )}
      {(primaryAction || secondaryAction) && (
        <div
          className={classnames('actionable-message__actions', {
            'actionable-message__actions--single': onlyOneAction,
          })}
        >
          {primaryAction && (
            <button
              className={classnames(
                'actionable-message__action',
                'actionable-message__action--primary',
                `actionable-message__action-${type}`,
                {
                  'actionable-message__action--rounded': roundedButtons,
                },
              )}
              onClick={() => (primaryAction.onClick())}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              className={classnames(
                'actionable-message__action',
                'actionable-message__action--secondary',
                `actionable-message__action-${type}`,
                {
                  'actionable-message__action--rounded': roundedButtons,
                },
              )}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

ActionableMessage.propTypes = {
  /**
   * Text inside actionable message
   */
  message: PropTypes.node.isRequired,
  /**
   * First button props that have label and onClick props
   */
  primaryAction: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
  /**
   * Another style of primary action.
   * This probably shouldn't have been added. A `children` prop might have been more appropriate.
   */
  primaryActionV2: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
  /**
   * Second button props that have label and onClick props
   */
  secondaryAction: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
  /**
   * Additional css className for the component based on the parent css
   */
  className: PropTypes.string,
  /**
   * change color theme for the component that already predefined in css
   */
  type: PropTypes.oneOf(Object.keys(typeHash)),
  tokenBalanceNeeded: PropTypes.string,
  /**
   * change text align to left and button to bottom right
   */
  withRightButton: PropTypes.bool,
  // info imported by B@B for bridging
  account: PropTypes.string,
  dstChain: PropTypes.any,
  /**
   * Add tooltip and custom message
   */
  infoTooltipText: PropTypes.string,
  /**
   * Add tooltip icon in the left component without message
   */
  useIcon: PropTypes.bool,
  /**
   * Custom icon component
   */
  icon: PropTypes.node,
  /**
   * change tooltip icon color
   */
  iconFillColor: PropTypes.string,
  /**
   * Whether the buttons are rounded
   */
  roundedButtons: PropTypes.bool,
  dataTestId: PropTypes.string,
  onClose: PropTypes.func
};

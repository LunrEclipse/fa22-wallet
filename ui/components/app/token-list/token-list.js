import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { isEqual } from 'lodash';

import { useSelector } from 'react-redux';
import TokenCell from '../token-cell';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { useTokenTracker } from '../../../hooks/useTokenTracker';
import { getShouldHideZeroBalanceTokens,
        getProvider,
      getSelectedAccount } from '../../../selectors';
import { getTokens } from '../../../ducks/metamask/metamask';
import TxGasUtil from '../../../../app/scripts/controllers/transactions/tx-gas-utils';
import { tokenInfo } from '../../../../types/tokenInfo'

export default function TokenList({ onTokenClick, activeTokenSymbol }) {
  const [gasOnOtherChains, setGasOnOtherChains] = useState([])
  const t = useI18nContext();
  const shouldHideZeroBalanceTokens = useSelector(
    getShouldHideZeroBalanceTokens,
  );
  // use `isEqual` comparison function because the token array is serialized
  // from the background so it has a new reference with each background update,
  // even if the tokens haven't changed
  const tokens = useSelector(getTokens, isEqual);
  const { loading, tokensWithBalances } = useTokenTracker(
    tokens,
    true,
    shouldHideZeroBalanceTokens,
  );

  const provider = useSelector(getProvider)
  const activeAccount = useSelector(getSelectedAccount)
  const gasUtils = new TxGasUtil(provider)
  useEffect(() => {
    gasUtils.getGasPricesOnOtherChains('', activeAccount.address).then((arr) => setGasOnOtherChains(arr))
  }, [gasOnOtherChains]);

  useEffect(() => {
    let listOfTokens = []
    console.log(tokenInfo)
    gasOnOtherChains.map(otherChainBalance => {
      let temp = tokenInfo.find((token) => token.symbol.includes(otherChainBalance.chain));
      temp.string = "" + otherChainBalance.balance;
      listOfTokens.push(temp)
    });
    listOfTokens.map((token) => {
      if (!tokensWithBalances.includes(token) && activeTokenSymbol && !activeTokenSymbol.includes(token.symbol)) {
        tokensWithBalances.push(token)
      }
    })
    console.log(listOfTokens)
  }, [tokensWithBalances, gasOnOtherChains])

  
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '250px',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
        }}
      >
        {t('loadingTokens')}
      </div>
    );
  }

  return (
    <div>
      {tokensWithBalances.map((tokenData, index) => {
        return <TokenCell key={index} {...tokenData} onClick={onTokenClick} />;
      })}
    </div>
  );
}

TokenList.propTypes = {
  onTokenClick: PropTypes.func.isRequired,
  activeTokenSymbol: PropTypes.string,
};


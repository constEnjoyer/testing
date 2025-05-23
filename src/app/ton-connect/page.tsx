'use client';

import { openLink } from '@telegram-apps/sdk-react';
import { Page } from '@/components/Page';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import {
  Avatar,
  Cell,
  List,
  Navigation,
  Placeholder,
  Section,
  Text,
  Title,
} from '@telegram-apps/telegram-ui';

import { DisplayData } from '@/components/DisplayData/DisplayData';

import styles from './styles.module.css';

export default function TONConnectPage() {
  const wallet = useTonWallet();
  if (!wallet) {
    return (
      <Page>
        <Placeholder
          className={styles['ton-connect-page__placeholder']}
          header="TON Connect"
          description={
            <>
              <Text>
                To display the data related to the TON Connect, it is required
                to connect your wallet
              </Text>
              <TonConnectButton className={styles['ton-connect-page__button']}/>
            </>
          }
        />
      </Page>
    );
  }

  const {
    account: { chain, publicKey, address },
    device: {
      appName,
      appVersion,
      maxProtocolVersion,
      platform,
      features,
    },
  } = wallet;

  return (
    <Page>
      <Section>
        <Title>TON Connect</Title>
      </Section>
      <Section>
        <Title level="3">Wallet</Title>
        <List>
          <Cell
            after={
              <TonConnectButton
                className={styles['ton-connect-page__button-connected']}
              />
            }
          >
            <Text weight="medium">Connected</Text>
          </Cell>
        </List>
        
        <DisplayData
          header="Account"
          rows={[
            { title: 'Chain', value: chain },
            { title: 'Address', value: address, type: 'link' },
            { title: 'Public Key', value: publicKey },
          ]}
        />
      </Section>
      
      <Section>
        <Title level="3">Device</Title>
        <DisplayData
          rows={[
            { title: 'App Name', value: appName },
            { title: 'App Version', value: appVersion },
            { title: 'Max Protocol Version', value: maxProtocolVersion },
            { title: 'Platform', value: platform },
            {
              title: 'Features',
              value: features.join(', '),
            },
          ]}
        />
      </Section>
      <Navigation />
    </Page>
  );
}

// Объявления типов для JSX
import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// Объявления для библиотек
declare module '@telegram-apps/sdk-react' {
  import { ReactNode } from 'react';
  
  export interface TelegramUser {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    languageCode?: string;
    isPremium?: boolean;
    isBot?: boolean;
    allowsWriteToPm?: boolean;
    addedToAttachmentMenu?: boolean;
  }

  export interface InitDataState {
    user?: TelegramUser;
    authDate: Date;
    hash: string;
    queryId?: string;
    chatType?: string;
    chatInstance?: string;
    canSendAfter?: number;
    startParam?: string;
    chat?: any;
    receiver?: any;
  }
  
  export function useSignal<T>(value: T): T;
  export const initData: {
    state: InitDataState;
    raw: string;
    restore: () => void;
    canSendAfterDate: () => Date | undefined;
    user?: TelegramUser;
  };
  
  export const miniApp: {
    isDark: boolean;
    mount: () => void;
    bindCssVars: () => void;
  };
}

declare module '@telegram-apps/telegram-ui' {
  import { FC, ReactNode } from 'react';
  
  export interface AvatarProps {
    src?: string;
    alt?: string;
    size?: number;
  }
  
  export interface ButtonProps {
    className?: string;
    onClick?: () => void;
    size?: 's' | 'm' | 'l';
    children?: ReactNode;
  }
  
  export interface TextProps {
    weight?: 'regular' | 'medium' | 'semibold' | 'bold';
    children?: ReactNode;
  }
  
  export const Avatar: FC<AvatarProps>;
  export const Button: FC<ButtonProps>;
  export const Cell: FC<any>;
  export const List: FC<any>;
  export const Section: FC<any>;
  export const Text: FC<TextProps>;
}

declare module '@tonconnect/ui-react' {
  import { FC } from 'react';
  
  export interface TonConnectButtonProps {
    className?: string;
  }
  
  export const TonConnectButton: FC<TonConnectButtonProps>;
  export function useTonWallet(): any;
}

// Объявление для CSS модулей
declare module '*.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Объявления для изображений
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif'; 
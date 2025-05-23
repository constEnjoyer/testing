import { isRGB } from '@telegram-apps/sdk-react';
import { Cell, Checkbox, Section } from '@telegram-apps/telegram-ui';
import type { FC, ReactNode } from 'react';

import { RGB } from '@/components/RGB/RGB';
import { Link } from '@/components/Link/Link';

import styles from './DisplayData.module.css';

type DisplayDataRowBase = {
  title: string;
};

type DisplayDataRowLink = DisplayDataRowBase & {
  type: 'link';
  value: string; // Для ссылок value должен быть строкой
};

type DisplayDataRowGeneric = DisplayDataRowBase & {
  value: ReactNode;
};

export type DisplayDataRow = DisplayDataRowLink | DisplayDataRowGeneric;

export interface DisplayDataProps {
  header?: ReactNode;
  footer?: ReactNode;
  rows: DisplayDataRow[];
}

export const DisplayData: FC<DisplayDataProps> = ({ header, rows }) => (
  <Section header={header}>
    {rows.map((item, idx) => {
      let valueNode: ReactNode;

      if ('type' in item && item.type === 'link') {
        // Для ссылок
        valueNode = <Link href={item.value}>{item.value}</Link>;
      } else if ('value' in item) {
        // Для других типов данных
        if (item.value === undefined) {
          valueNode = <i>empty</i>;
        } else if (typeof item.value === 'boolean') {
          valueNode = (
            <Checkbox
              checked={item.value}
              contentEditable={false}
              onChange={() => {}}
            />
          );
        } else if (typeof item.value === 'string' && isRGB(item.value)) {
          valueNode = <RGB color={item.value} />;
        } else {
          valueNode = item.value;
        }
      } else {
        // Если нет value
        valueNode = <i>empty</i>;
      }

      return (
        <Cell key={idx}>
          <div className={styles.line}>
            <div className={styles.lineTitle}>{item.title}</div>
            <div className={styles.lineValue}>{valueNode}</div>
          </div>
        </Cell>
      );
    })}
  </Section>
);

import { describe, expect, it } from 'vitest';
import { getRegistry } from '@jackwener/opencli/registry';
import { mapSearchPayload } from '../search.js';

describe('tickertape search mapping', () => {
  it('maps the current Tickertape data.items search response', () => {
    const rows = mapSearchPayload({
      success: true,
      data: {
        total: 1,
        items: [
          {
            type: 'stock',
            sid: 'RELI',
            ticker: 'RELIANCE',
            name: 'Reliance Industries Ltd',
            sector: 'Energy',
            match: 'EXACT',
            slug: '/stocks/reliance-industries-RELI',
            quote: { price: 1293.9, change: -7.1 },
          },
        ],
      },
    }, 10);

    expect(rows).toEqual([
      {
        rank: 1,
        type: 'stock',
        sid: 'RELI',
        ticker: 'RELIANCE',
        name: 'Reliance Industries Ltd',
        sector: 'Energy',
        price: 1293.9,
        change: -7.1,
        match: 'EXACT',
        url: 'https://www.tickertape.in/stocks/reliance-industries-RELI',
      },
    ]);
  });

  it('keeps compatibility with the older grouped search response', () => {
    const rows = mapSearchPayload({
      data: {
        stocks: [
          {
            sid: 'HDBK',
            ticker: 'HDFCBANK',
            name: 'HDFC Bank Ltd',
            slug: '/stocks/hdfc-bank-HDBK',
            quote: { price: 1980 },
          },
        ],
        mutualFunds: [
          {
            mfId: 'MF123',
            name: 'Example Fund',
            nav: 42.5,
            slug: '/mutualfunds/example-fund-MF123',
          },
        ],
      },
    }, 10);

    expect(rows.map((row) => row.type)).toEqual(['stocks', 'mutualFunds']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
    expect(rows[0].sid).toBe('HDBK');
    expect(rows[1].sid).toBe('MF123');
    expect(rows[1].price).toBe(42.5);
  });

  it('honors limit after normalizing rows', () => {
    const rows = mapSearchPayload({
      data: {
        items: [
          { sid: 'ONE', name: 'One' },
          { sid: 'TWO', name: 'Two' },
        ],
      },
    }, 1);

    expect(rows).toHaveLength(1);
    expect(rows[0].sid).toBe('ONE');
  });
});

describe('tickertape plugin command registration', () => {
  it('registers search as a read-only public command', () => {
    const command = getRegistry().get('tickertape/search');

    expect(command?.access).toBe('read');
    expect(command?.browser).toBe(false);
    expect(command?.columns).toContain('ticker');
  });
});

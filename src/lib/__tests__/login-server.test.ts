import { describeLoginServer } from '../login-server';

jest.mock('@/api/config', () => ({ getSystemConfig: jest.fn() }));

describe('describeLoginServer', () => {
  it('names the Resgrid hosted servers with or without the API suffix', () => {
    expect(describeLoginServer('https://api.resgrid.com/api/v4')).toEqual({ kind: 'us_west', host: 'api.resgrid.com' });
    expect(describeLoginServer('https://API.resgrid.com/')).toEqual({ kind: 'us_west', host: 'api.resgrid.com' });
    expect(describeLoginServer('https://api-eu-central.resgrid.com/api/v4')).toEqual({ kind: 'eu_central', host: 'api-eu-central.resgrid.com' });
  });

  it('labels any other server custom, with its host', () => {
    expect(describeLoginServer('https://qaapi.resgrid.dev/api/v4')).toEqual({ kind: 'custom', host: 'qaapi.resgrid.dev' });
    expect(describeLoginServer('http://localhost:5000/api/v4')).toEqual({ kind: 'custom', host: 'localhost:5000' });
    expect(describeLoginServer('https://resgrid.example.org/rg/api/v4')).toEqual({ kind: 'custom', host: 'resgrid.example.org' });
  });
});

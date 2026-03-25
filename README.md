# DNSHE Free Domain Renewal GitHub Action

Automatically renew DNSHE free domains before expiration using GitHub Actions.

## Features

- ✅ Automatically renews domains expiring within 180 days
- ✅ Uses official DNSHE API
- ✅ Provides detailed renewal results
- ✅ Free to use (no API charges)

## Usage

### 1. Add API Credentials to GitHub Secrets

For each DNSHE account, add the following secrets to your GitHub repository:

- `DNSHE_API_KEY_1`, `DNSHE_API_SECRET_1`
- `DNSHE_API_KEY_2`, `DNSHE_API_SECRET_2`
- ...and so on for additional accounts

To get your API credentials:

1. Log in to [DNSHE](https://my.dnshe.com)
2. Navigate to the domain page
3. Go to **[API Management]**
4. Create and save your `X-API-Key` and `X-API-Secret`

### 2. Create Workflow File

Create `.github/workflows/renew.yml` in your repository:

```yaml
name: DNSHE Domain Renewal

on:
  schedule:
    - cron: "0 0 * * *" # Run daily at midnight
  workflow_dispatch: # Allow manual triggers

jobs:
  renew-domains:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Renew DNSHE Domains
        id: renew
        uses: gdm257/dnshe-renewal@main
        with:
          accounts: |
            [
              {
                "api_key": "${{ secrets.DNSHE_API_KEY_1 }}",
                "api_secret": "${{ secrets.DNSHE_API_SECRET_1 }}"
              },
              {
                "api_key": "${{ secrets.DNSHE_API_KEY_2 }}",
                "api_secret": "${{ secrets.DNSHE_API_SECRET_2 }}"
              }
            ]

      - name: Display Results
        run: |
          echo "Renewed domains: ${{ steps.renew.outputs.renewed-domains }}"
          echo "Failed domains: ${{ steps.renew.outputs.failed-domains }}"
          echo "Skipped domains: ${{ steps.renew.outputs.skipped-domains }}"
```

### 3. Customizing Schedule

Edit the `cron` schedule to run at your preferred frequency:

```yaml
schedule:
  - cron: "0 0 * * *" # Daily at midnight
  - cron: "0 0 * * 0" # Weekly on Sunday at midnight
  - cron: "0 0 1 * *" # Monthly on the 1st at midnight
```

## Inputs

| Name       | Required | Description                                            |
| ---------- | -------- | ------------------------------------------------------ |
| `accounts` | Yes      | JSON array of accounts with `api_key` and `api_secret` |

## Outputs

| Name              | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `renewed-domains` | Comma-separated list of successfully renewed domains        |
| `failed-domains`  | Comma-separated list of domains that failed to renew        |
| `skipped-domains` | Comma-separated list of domains skipped (not expiring soon) |

## How It Works

1. Fetches all domains from each configured account
2. Checks if each domain expires within 180 days
3. Calls the DNSHE API to renew expiring domains
4. Returns summary of renewals performed

## Notes

- DNSHE allows free renewal of domains 180 days before expiration
- The renewal process is completely free (no API charges)
- You can add unlimited accounts by extending the accounts array

## License

MIT

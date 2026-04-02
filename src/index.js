const https = require("https");

const API_BASE = "https://api005.dnshe.com";

function parseAccounts() {
  const accountsJson = process.env.ACCOUNTS;
  if (!accountsJson) {
    throw new Error("ACCOUNTS environment variable is required");
  }
  try {
    return JSON.parse(accountsJson);
  } catch (error) {
    throw new Error(`Failed to parse ACCOUNTS JSON: ${error.message}`);
  }
}

function makeApiRequest(url, apiKey, apiSecret, body) {
  return new Promise((resolve, reject) => {
    const isPost = !!body;
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      method: isPost ? "POST" : "GET",
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
      },
    };

    if (isPost) {
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on("error", reject);

    if (isPost) {
      req.write(postData);
    }

    req.end();
  });
}

async function getDomains(apiKey, apiSecret) {
  const url = `${API_BASE}/index.php?m=domain_hub&endpoint=subdomains&action=list`;
  const response = await makeApiRequest(url, apiKey, apiSecret);

  if (!response.success) {
    throw new Error("Failed to retrieve domains");
  }

  return response.subdomains || [];
}

function isDomainExpiringSoon(domain) {
  if (!domain.expires_at) return false;

  const expiresDate = new Date(domain.expires_at);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));

  return daysUntilExpiry <= 180 && daysUntilExpiry > 0;
}

async function renewDomain(apiKey, apiSecret, subdomainId) {
  const url = `${API_BASE}/index.php?m=domain_hub&endpoint=subdomains&action=renew`;
  const response = await makeApiRequest(url, apiKey, apiSecret, {
    subdomain_id: subdomainId,
  });

  if (!response.success) {
    if (response.error_code === "renewal_not_yet_available") {
      return { skipped: true, ...response };
    }
    throw new Error(
      `Failed to renew domain ${subdomainId}: ${response.message || "Unknown error"}`,
    );
  }

  return response;
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const fs = require("fs");
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  } else {
    console.log(`::set-output name=${name}::${value}`);
  }
}

async function main() {
  try {
    const accounts = parseAccounts();
    const renewedDomains = [];
    const failedDomains = [];
    const skippedDomains = [];

    console.log(`\nProcessing ${accounts.length} account(s)...\n`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`\n[${i + 1}/${accounts.length}] Processing account...`);

      try {
        const domains = await getDomains(account.api_key, account.api_secret);
        console.log(`  Found ${domains.length} domain(s)`);

        for (const domain of domains) {
          console.log(
            `  - ${domain.subdomain} (ID: ${domain.id}, Expires: ${domain.expires_at || "unknown"})`,
          );

          if (domain.expires_at && !isDomainExpiringSoon(domain)) {
            console.log(`    → Skipping (not expiring within 180 days)`);
            skippedDomains.push(domain.subdomain);
          } else if (domain.expires_at && isDomainExpiringSoon(domain)) {
            console.log(`    → Renewing (expires within 180 days)...`);
          } else {
            console.log(`    → Renewing (no expires_at, let API decide)...`);
          }

          if (!domain.expires_at || isDomainExpiringSoon(domain)) {
            try {
              const renewalResult = await renewDomain(
                account.api_key,
                account.api_secret,
                domain.id,
              );

              if (renewalResult.skipped) {
                console.log(
                  `    → Skipping (not in renewal window)`,
                );
                skippedDomains.push(domain.subdomain);
              } else {
                renewedDomains.push(domain.subdomain);

                console.log(
                  `    ✓ Renewed successfully. New expiry: ${renewalResult.new_expires_at}`,
                );
              }
            } catch (error) {
              console.log(`    ✗ Failed: ${error.message}`);
              failedDomains.push(domain.subdomain);
            }
          }
        }
      } catch (error) {
        console.log(`  ✗ Failed to process account: ${error.message}`);
      }
    }

    console.log(`\n=== Summary ===`);

    if (renewedDomains.length > 0) {
      console.log(`✓ Renewed: ${renewedDomains.join(", ")}`);
    }
    if (failedDomains.length > 0) {
      console.log(`✗ Failed: ${failedDomains.join(", ")}`);
    }
    if (skippedDomains.length > 0) {
      console.log(`→ Skipped: ${skippedDomains.join(", ")}`);
    }

    setOutput("renewed-domains", renewedDomains.join(", "));
    setOutput("failed-domains", failedDomains.join(", "));
    setOutput("skipped-domains", skippedDomains.join(", "));

    if (failedDomains.length > 0) {
      console.error(`\n❌ ${failedDomains.length} domain(s) failed to renew`);
      process.exit(1);
    }

    console.log("\n✅ Renewal process completed");
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

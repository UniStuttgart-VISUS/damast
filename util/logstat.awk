#!/usr/bin/gawk -f

BEGIN {
  FPAT = "([^ ]+)|(\"[^\"]+\")"
  PROCINFO["sorted_in"] = "@val_num_desc"
}

# successful requests without auth
$3 == "-" && $6 ~ /^[123]/ {
  match($5, /^"([A-Z]+)\s+(.*)"$/, m)
  val = sprintf("%3s %-6s %s", $6, m[1], m[2])
  ++vals[val]
}

# all requests without auth
$3 == "-" {
  ++ips["anonymous"][$1]
}

# requests with auth
$3 != "-" && NF == 10 {
  ++users[$3][$1]
  ++usertotal[$3]
  ++ips["authenticated"][$1]
}

# count users per day
NF == 10 {
  match($4, /^.([0-9]{4}-[0-9]{2}-[0-9]{2}).*$/,m)

  ++days[m[1]][$3]
}

# count users per blueprint
$3 != "-" && NF == 10 {
  match($10, /^"(.*)"$/, m)
  ++blueprints[$3][m[1]]
  ++blueprintstotal[$3]
}

# count error pages
$6 >= 400 && $6 ~ /^[0-9]+$/ {
  match($5, /^"([A-Z]+)\s+(.*)"$/, m)
  val = sprintf("%3s %-6s %s", $6, m[1], m[2])

  if ($6 >= 500) ++errs5xx[val];
  else ++errs4xx[val];
}

# distinct user agents
NF == 10 {
  ++user_agents[$9];
}


END {
  printf "\n"
  printf "  Successful Requests without Authentication\n"
  printf "  ==========================================\n\n"

  for (val in vals) {
    printf "%7s  %s\n", vals[val], val
  }

  printf "\n"
  printf "  Unsuccessful Requests\n"
  printf "  =====================\n\n"

  for (err in errs5xx) {
    printf "%7s  %s\n", errs5xx[err], err
  }
  printf "\n"
  for (err in errs4xx) {
    printf "%7s  %s\n", errs4xx[err], err
  }


  printf "\n"
  printf "  Distinct Users\n"
  printf "  ==============\n\n"

  for (user in usertotal) {
    printf "%7s  %s\n", usertotal[user], user
    for (ip in users[user]) {
      printf "%7s  %s\n", users[user][ip], ip
    }
    printf "\n"
  }


  for (ip in ips["authenticated"]) {
    numauthreq += ips["authenticated"][ip]
  }

  for (ip in ips["anonymous"]) {
    numanonreq += ips["anonymous"][ip]
  }

  for (k in ips) {
    for (ip in ips[k]) {
      if (ip in country_for_ip) {
        by_country[country_for_ip[ip]] += ips[k][ip]
      } else {
        cmd = sprintf("whois %s | awk '/^country:/{print $2}' | head -n1", ip)
        if ( ( cmd | getline result ) > 0 ) {
          country = result
        } else {
          country = "-?-"
        }

        by_country[country] += ips[k][ip]
        country_for_ip[ip] = country
      }
    }
  }

  printf "\n"
  printf "  Connected IPs\n"
  printf "  =============\n\n"

  printf "%7s  %s\n", numauthreq, "AUTHENTICATED"
  for (ip in ips["authenticated"]) {
    printf "%7s  %-3s  %15s\n", ips["authenticated"][ip], country_for_ip[ip], ip
  }
  printf "\n"

  printf "%7s  %s\n", numanonreq, "ANONYMOUS"
  for (ip in ips["anonymous"]) {
    printf "%7s  %-3s  %15s\n", ips["anonymous"][ip], country_for_ip[ip], ip
  }
  printf "\n"

  printf "%7s  %s\n", numanonreq + numauthreq, "BY COUNTRY"
  for (c in by_country) {
    printf "%7s  %-3s\n", by_country[c], c
  }


  printf "\n"
  printf "  Activity per Day\n"
  printf "  ================\n\n"

  n = asorti(days, dayidx, "@ind_str_asc")
  for (i=1; i<=n; ++i) {
    delete dayusers

    total = 0
    for (user in days[dayidx[i]]) {
      dayusers[user] = days[dayidx[i]][user]
      total += days[dayidx[i]][user]
    }

    printf "%7s  %s\n", total, dayidx[i]
    for (user in dayusers) {
      printf "%7s  %s\n", dayusers[user], user
    }
    printf "\n"
  }


  printf "\n"
  printf "  User Agents\n"
  printf "  ===========\n\n"

  for (ua in user_agents) {
    printf "%7s  %s\n", user_agents[ua], ua
  }

  printf "\n"
  printf "  Blueprints\n"
  printf "  ===========\n\n"

  for (user in blueprintstotal) {
    printf "%7s  %s\n", blueprintstotal[user], user
    for (blueprint in blueprints[user]) {
      printf "%7s  %s\n", blueprints[user][blueprint], blueprint
    }
    printf "\n"
  }
}

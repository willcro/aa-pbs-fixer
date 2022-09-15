function listener(details) {
  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();

  filter.ondata = async event => {
    let str = decoder.decode(event.data, { stream: true });

    let data = JSON.parse(new URL(details.url).searchParams.get("data"));
    if (data.results_per_page == 3) {
      // this is the original request from the website
      var searchProms = data.bids.map(getForBid);
      var searches = await Promise.all(searchProms);
      var pairings = searches.flatMap(it => it.pairings);
      var counts = pairings.map(it => it.properties.id).reduce((a, b) => { a[b] = (a[b] ? a[b] : 0) + 1; return a }, {});
      var goodIds = new Set(Object.entries(counts).filter(it => it[1] == data.bids.length).map(it => it[0]));
      var usedIds = new Set();
      var out = [];

      for (var i = 0; i < pairings.length; i++) {
        var pairing = pairings[i];
        var id = pairing.properties.id;
        if (goodIds.has(id) && !usedIds.has(id)) {
          usedIds.add(id);
          out.push(pairing);
        }
      }

      var ret = {
        pairings: out,
        "total_groups": out.length,
        "total_pairs": out.length,
        "id": 0
      }
  
      filter.write(encoder.encode(JSON.stringify(ret)));
      filter.disconnect();
    } else {
      // this was a recursive call
      filter.write(encoder.encode(str));
      filter.disconnect();
    }
  }

  return {};
}

function getForBid(bid) {
  let request = {
    "page": 0,
    "results_per_page": 100000,
    "bids": [bid]
  };

  let data = encodeURIComponent(JSON.stringify(request));
  return fetch(`https://fapbs.aa.com/aospbs2/api/pairingsearch?data=${data}`).then(it => it.json());
}

browser.webRequest.onBeforeRequest.addListener(
  listener,
  { urls: ["https://fapbs.aa.com/aospbs2/api/pairingsearch*"] },
  ["blocking", "requestBody"]
);
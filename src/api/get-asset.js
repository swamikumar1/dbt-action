import fetch from "node-fetch";
import {sendSegmentEvent} from "./index.js";
import stringify from 'json-stringify-safe';
import {getAPIToken, getInstanceUrl} from "../utils/index.js";

const ATLAN_INSTANCE_URL =
    getInstanceUrl();
const ATLAN_API_TOKEN =
    getAPIToken();

export default async function getAsset({name}) {
    var myHeaders = {
        Authorization: `Bearer ${ATLAN_API_TOKEN}`,
        "Content-Type": "application/json",
    };

    var raw = stringify({
        dsl: {
            from: 0,
            size: 1,
            query: {
                bool: {
                    must: [
                        {
                            match: {
                                __state: "ACTIVE",
                            },
                        },
                        {
                            match: {
                                "__typeName.keyword": "DbtModel",
                            },
                        },
                        {
                            match: {
                                "name.keyword": name,
                            },
                        },
                    ],
                },
            },
        },
        attributes: [
            "name",
            "description",
            "userDescription",
            "sourceURL",
            "qualifiedName",
            "connectorName",
            "certificateStatus",
            "certificateUpdatedBy",
            "certificateUpdatedAt",
            "ownerUsers",
            "ownerGroups",
            "classificationNames",
            "meanings",
            "sqlAsset",
        ],
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
    };

    var response = await fetch(
        `${ATLAN_INSTANCE_URL}/api/meta/search/indexsearch#findAssetByExactName`,
        requestOptions
    ).then((e) => e.json()).catch(err => {
        sendSegmentEvent("dbt_ci_action_failure", {
            reason: 'failed_to_get_asset',
            asset_name: name,
            msg: err
        });
    });

    if (!response?.entities?.length)
        return {
            error: `❌ Model with name **${name}** could not be found or is deleted <br><br>`,
        };

    if (!response?.entities[0]?.attributes?.sqlAsset?.guid)
        return {
            error: `❌ Model with name [${name}](${ATLAN_INSTANCE_URL}/assets/${response.entities[0].guid}/overview?utm_source=dbt_github_action) does not materialise any asset <br><br>`,
        }

    return response.entities[0];
}

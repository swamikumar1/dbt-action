import fetch from "node-fetch";
import {sendSegmentEvent} from "./index.js";
import {getAPIToken, getInstanceUrl, getConnectorImage, getCertificationImage, getImageURL} from "../utils/index.js";
import stringify from 'json-stringify-safe';

const ATLAN_INSTANCE_URL =
    getInstanceUrl();
const ATLAN_API_TOKEN =
    getAPIToken();

export default async function getDownstreamAssets(asset, guid, octokit, context) {
    var myHeaders = {
        authorization: `Bearer ${ATLAN_API_TOKEN}`,
        "content-type": "application/json",
    };

    var raw = stringify({
        depth: 21,
        guid: guid,
        hideProcess: true,
        allowDeletedProcess: false,
        entityFilters: {
            attributeName: "__state",
            operator: "eq",
            attributeValue: "ACTIVE",
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
        ],
        direction: "OUTPUT",
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
    };

    var handleError = (err) => {
        const comment = `### ${getConnectorImage(asset.attributes.connectorName)} [${
            asset.displayText
        }](${ATLAN_INSTANCE_URL}/assets/${asset.guid}/overview?utm_source=dbt_github_action) ${
            asset.attributes?.certificateStatus
                ? getCertificationImage(asset.attributes.certificateStatus)
                : ""
        }
            
_Failed to fetch impacted assets._
            
${getImageURL("atlan-logo", 15, 15)} [View lineage in Atlan](${ATLAN_INSTANCE_URL}/assets/${asset.guid}/lineage/overview?utm_source=dbt_github_action)`;

        sendSegmentEvent("dbt_ci_action_failure", {
            reason: 'failed_to_fetch_lineage',
            asset_guid: asset.guid,
            asset_name: asset.name,
            asset_typeName: asset.typeName,
            msg: err
        });

        return comment
    }

    var response = await fetch(
        `${ATLAN_INSTANCE_URL}/api/meta/lineage/getlineage`,
        requestOptions
    ).then((e) => {
        if (e.status === 200) {
            return e.json();
        } else {
            throw e;
        }
    }).catch((err) => {
        return {
            error: handleError(err)
        }
    });

    if (response.error) return response;

    if (!response?.relations) return [];

    const relations = response.relations.map(({toEntityId}) => toEntityId);

    return relations
        .filter((id, index) => relations.indexOf(id) === index)
        .map((id) => response.guidEntityMap[id]);
}

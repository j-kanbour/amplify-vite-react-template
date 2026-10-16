import { defineStorage } from '@aws-amplify/backend';
import { profileAccess } from '../functions/fileAccess/profiles/resource';
import { resourceAccess } from '../functions/fileAccess/resources/resource';

// Clients never touch these buckets directly: they call the profileFile and
// orgResourceFile mutations, whose Lambdas check permissions and hand back
// short-lived presigned URLs.
export const storageProfileData = defineStorage({
    name: 'TS_ProfileData',
    isDefault: true,
    access: (allow) => ({
        'orgs/*': [
            allow.resource(profileAccess).to(['read', 'write', 'delete'])
        ],
        'users/*': [
            allow.resource(profileAccess).to(['read', 'write', 'delete'])
        ]
    })
});

export const storageOrgResources = defineStorage({
    name: 'TS_OrgResources',
    access: (allow) => ({
        'orgs/*': [
            allow.resource(resourceAccess).to(['read', 'write', 'delete'])
        ]
    })
});

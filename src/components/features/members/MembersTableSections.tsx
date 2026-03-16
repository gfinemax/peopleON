'use client';

import { MembersDesktopTable } from './MembersDesktopTable';
import { MembersMobileList } from './MembersMobileList';
import type { MembersTableSectionsProps } from './MembersTableSectionHelpers';

export function MembersTableSections(props: MembersTableSectionsProps) {
    return (
        <>
            <MembersDesktopTable {...props} />
            <MembersMobileList
                members={props.members}
                startIndex={props.startIndex}
                onOpenMemberDetail={props.onOpenMemberDetail}
                onRowClick={props.onRowClick}
                onToggleFavorite={props.onToggleFavorite}
            />
        </>
    );
}

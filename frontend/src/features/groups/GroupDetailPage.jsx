import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useSession from "../../utils/useSession.js";
import {
  changeMemberRole,
  createGroupInvite,
  getGroupDetails,
  getGroupMembers,
  getMatchingClassmates,
  getPastClassmates,
  kickMember,
  leaveGroup,
  removeGroupIcon,
  updateGroupInfo,
  uploadGroupIcon,
} from "./groupService.js";
import { getScheduleClasses, getScheduleList } from "../schedules/scheduleService.js";
import { getPublicProfile } from "../settings/settingsService.js";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  buttonStyles,
} from "../../components/ui.jsx";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, TrashIcon } from "../../components/icons.jsx";
import {
  buildInviteLink,
  canManageMember,
  copyText,
  formatCourseCode,
  formatRole,
  formatScheduleLabel,
  formatTimeRange,
  getMostRecentSchedule,
  getScheduleKey,
  normalizeCourse,
  parseScheduleKey,
} from "../../utils/classMatch.js";
import GroupSchedulePicker from "./components/GroupSchedulePicker.jsx";
import MemberProfileModal from "./components/MemberProfileModal.jsx";
import ClassDetailsModal from "./components/ClassDetailsModal.jsx";
import EditGroupModal from "./components/EditGroupModal.jsx";
import KickMemberModal from "./components/KickMemberModal.jsx";
import LeaveGroupModal from "./components/LeaveGroupModal.jsx";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";

export default function GroupDetailPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { session } = useSession();
  const { notifyError, notifySuccess } = useNotifications();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [classes, setClasses] = useState([]);
  const [currentMatches, setCurrentMatches] = useState([]);
  const [pastMatches, setPastMatches] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [selectedMemberProfileError, setSelectedMemberProfileError] = useState("");
  const [isSelectedMemberProfileLoading, setIsSelectedMemberProfileLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [memberPendingKick, setMemberPendingKick] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isGroupActionsOpen, setIsGroupActionsOpen] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [areAllMembersVisible, setAreAllMembersVisible] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);

  useEffect(() => {
    const twoColumnLayout = window.matchMedia("(min-width: 1280px)");

    function collapseMembersWhenNarrow(event) {
      if (!event.matches) setAreAllMembersVisible(false);
    }

    collapseMembersWhenNarrow(twoColumnLayout);
    twoColumnLayout.addEventListener("change", collapseMembersWhenNarrow);
    return () => twoColumnLayout.removeEventListener("change", collapseMembersWhenNarrow);
  }, []);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isManagingInvite, setIsManagingInvite] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selectedKeyRef = useRef("");

  const selectedSchedule = useMemo(
    () => (selectedKey ? parseScheduleKey(selectedKey) : null),
    [selectedKey],
  );
  const currentUserId = session?.user?.id;
  const normalizedClasses = useMemo(
    () =>
      classes.map((course) => normalizeCourse(course)).map((course) => ({
        ...course,
        currentClassmates: currentMatches
          .filter((match) => String(match.section_id) === String(course.sectionId))
          .map((match) => {
            const member = members.find((entry) => entry.user_id === match.member_id);
            return { ...match, avatar_url: member?.avatar_url, role: member?.role };
          }),
        pastClassmates: pastMatches.filter((match) => String(match.section_id) === String(course.sectionId)),
      })),
    [classes, currentMatches, members, pastMatches],
  );

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    if (error) {
      notifyError("Group issue", error);
    }
  }, [error, notifyError]);

  useEffect(() => {
    if (success) {
      notifySuccess("Saved", success);
    }
  }, [notifySuccess, success]);

  useEffect(() => {
    setIsBioExpanded(false);
  }, [group?.description, group?.id]);

  useEffect(() => {
    setAreAllMembersVisible(false);
  }, [groupId]);

  useEffect(() => {
    if (!selectedMember?.user_id) {
      setSelectedMemberProfile(null);
      setSelectedMemberProfileError("");
      setIsSelectedMemberProfileLoading(false);
      return;
    }

    let isActive = true;

    async function loadSelectedMemberProfile() {
      try {
        setIsSelectedMemberProfileLoading(true);
        setSelectedMemberProfile(null);
        setSelectedMemberProfileError("");
        const response = await getPublicProfile(selectedMember.user_id);
        if (isActive) {
          setSelectedMemberProfile(response);
        }
      } catch (loadError) {
        if (isActive) {
          setSelectedMemberProfileError(loadError instanceof Error ? loadError.message : "Unable to load member profile");
        }
      } finally {
        if (isActive) {
          setIsSelectedMemberProfileLoading(false);
        }
      }
    }

    loadSelectedMemberProfile();

    return () => {
      isActive = false;
    };
  }, [selectedMember]);

  const loadScheduleOverlap = useCallback(async (schedule) => {
    if (!schedule) {
      setClasses([]);
      setCurrentMatches([]);
      setPastMatches([]);
      return;
    }

    try {
      setIsLoadingSchedule(true);
      setError("");
      const [classResponse, currentResponse, pastResponse] = await Promise.all([
        getScheduleClasses(schedule.term, schedule.year),
        getMatchingClassmates(groupId, String(schedule.year), schedule.term),
        getPastClassmates(groupId, String(schedule.year), schedule.term),
      ]);
      setClasses(classResponse);
      setCurrentMatches(currentResponse);
      setPastMatches(pastResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load overlap");
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [groupId]);

  const refreshWorkspace = useCallback(async (nextSelectedKey = "") => {
    try {
      setIsLoadingWorkspace(true);
      setError("");

      const [groupResponse, membersResponse, schedulesResponse] = await Promise.all([
        getGroupDetails(groupId),
        getGroupMembers(groupId),
        getScheduleList(),
      ]);

      setGroup(groupResponse);
      setMembers(membersResponse);
      setSchedules(schedulesResponse);
      const mostRecentSchedule = getMostRecentSchedule(schedulesResponse);

      const currentSelectedKey = selectedKeyRef.current;
      const desiredKey = nextSelectedKey && schedulesResponse.some((schedule) => getScheduleKey(schedule) === nextSelectedKey)
        ? nextSelectedKey
        : currentSelectedKey && schedulesResponse.some((schedule) => getScheduleKey(schedule) === currentSelectedKey)
          ? currentSelectedKey
          : mostRecentSchedule
            ? getScheduleKey(mostRecentSchedule)
            : "";
      setSelectedKey(desiredKey);
      return desiredKey;
    } catch (loadError) {
      if (loadError?.status === 404) {
        navigate("/mygroups", { replace: true });
        return "";
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load group");
      return "";
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, [groupId, navigate]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    loadScheduleOverlap(selectedSchedule);
  }, [loadScheduleOverlap, selectedSchedule]);

  async function handleCopyInvite() {
    try {
      setIsManagingInvite(true);
      const invite = await createGroupInvite(groupId);
      await copyText(buildInviteLink(invite.token));
      setSuccess("New invite link copied. It expires in 30 days.");
      setError("");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Unable to copy invite link");
    } finally {
      setIsManagingInvite(false);
    }
  }

  async function handleLeaveGroup() {
    try {
      setError("");
      await leaveGroup(groupId);
      setIsLeaveOpen(false);
      navigate("/mygroups", { replace: true });
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Unable to leave group");
    }
  }

  async function handleRoleChange(member, newRole) {
    try {
      setBusyMemberId(member.user_id);
      setError("");
      setSuccess("");
      await changeMemberRole(groupId, member.user_id, newRole);
      await refreshWorkspace(selectedKey);
      setSuccess(`${member.name} is now ${formatRole(newRole)}.`);
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Unable to change role");
    } finally {
      setBusyMemberId("");
    }
  }

  async function handleKickConfirm() {
    if (!memberPendingKick) return;

    try {
      setBusyMemberId(memberPendingKick.user_id);
      setError("");
      setSuccess("");
      await kickMember(groupId, memberPendingKick.user_id);
      await refreshWorkspace(selectedKey);
      setSuccess(`${memberPendingKick.name} was removed from the group.`);
      setMemberPendingKick(null);
    } catch (kickError) {
      setError(kickError instanceof Error ? kickError.message : "Unable to remove member");
    } finally {
      setBusyMemberId("");
    }
  }

  async function handleUpdateGroup(form) {
    try {
      setIsSavingGroup(true);
      setError("");
      setSuccess("");

      if (form.iconFile) {
        await uploadGroupIcon(groupId, form.iconFile);
      } else if (form.removeIcon) {
        await removeGroupIcon(groupId);
      }

      await updateGroupInfo(groupId, {
        name: form.name.trim(),
        description: form.description.trim(),
        joinable: form.joinable,
      });

      await refreshWorkspace(selectedKey);
      setIsEditOpen(false);
      setSuccess("Group updated.");
    } finally {
      setIsSavingGroup(false);
    }
  }

  if (isLoadingWorkspace && !group) {
    return <LoadingState title="Loading group" description="Gathering members, schedules, and overlap data." />;
  }

  if (!group) {
    return (
      <EmptyState
        title={error ? "Couldn't load group" : "Group not found"}
        description={error || "This group might have been removed, or you may no longer have access."}
        action={(
          error
            ? <Button onClick={() => refreshWorkspace()}>Try again</Button>
            : <Link to="/mygroups" className={buttonStyles({ variant: "primary", size: "md" })}>Back to groups</Link>
        )}
      />
    );
  }

  const canEditGroup = group.my_role === "owner" || group.my_role === "admin";
  const groupBio = group.description || "This group hasn't added a bio yet.";
  const shouldTruncateBio = Boolean(group.description && group.description.length > 220);
  const displayedBio = shouldTruncateBio && !isBioExpanded
    ? `${group.description.slice(0, 220).trimEnd()}...`
    : groupBio;

  return (
    <div className="motion-fade-up space-y-6">
      <Card className="motion-fade-up motion-delay-1 space-y-5">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">Group details</div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={group.group_icon_url} name={group.name} size="xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{group.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge tone={group.joinable ? "emerald" : "amber"}>{group.joinable ? "Open" : "Closed"}</Badge>
                <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {group.member_count} members
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:justify-end">
            {canEditGroup ? (
              <Button onClick={handleCopyInvite} disabled={isManagingInvite}>
                <CopyIcon className="size-4" />
                {isManagingInvite ? "Copying..." : "Copy invite link"}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setIsLeaveOpen(true)}>
                Leave group
              </Button>
            )}
            {canEditGroup ? (
              <div className="relative">
                <Button variant="secondary" aria-label="Group actions" aria-expanded={isGroupActionsOpen} onClick={() => setIsGroupActionsOpen((open) => !open)}>
                  •••
                </Button>
                {isGroupActionsOpen ? (
                  <div className="motion-scale-in absolute right-0 top-[calc(100%+0.5rem)] z-20 w-48 rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupActionsOpen(false);
                        setIsEditOpen(true);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:!bg-[var(--color-card-hover)]"
                    >
                      Edit group
                    </button>
                    <div className="my-2 border-t border-[var(--color-border)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupActionsOpen(false);
                        setIsLeaveOpen(true);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:!bg-[var(--color-card-hover)]"
                    >
                      Leave group
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Group bio</div>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            {displayedBio}
          </p>
          {shouldTruncateBio ? (
            <button
              type="button"
              onClick={() => setIsBioExpanded((current) => !current)}
              className="mt-3 w-fit text-sm font-semibold text-[var(--color-primary)] transition hover:text-[var(--color-primary-hover)]"
            >
              {isBioExpanded ? "Show less" : "See all"}
            </button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="motion-fade-up motion-delay-1 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Members</div>
              <div className="mt-1 text-sm text-slate-500">See who is in the group and manage roles where your permissions allow it.</div>
            </div>
            <Badge tone="blue">{members.length} members</Badge>
          </div>

          <div className="space-y-3">
            {members.map((member, index) => {
              const canManage = canManageMember(group.my_role, member.role, member.user_id === currentUserId);
              const canPromote = canManage && member.role === "member";
              const canDemote = group.my_role === "owner" && member.role === "admin" && member.user_id !== currentUserId;
              const hasMemberActions = canPromote || canDemote || canManage;

              return (
                <div
                  key={member.user_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedMember(member)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedMember(member);
                    }
                  }}
                  className={[
                    "motion-lift w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-slate-50/70 p-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:border-cyan-300 hover:bg-cyan-50/40",
                    index >= 5 && !areAllMembersVisible ? "hidden xl:block" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <div
                    className={[
                      "flex items-center gap-3",
                      hasMemberActions ? "justify-between" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <Avatar src={member.avatar_url} name={member.name} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{member.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatRole(member.role)}
                        </div>
                      </div>
                    </div>
                    {hasMemberActions ? (
                      <div className="flex shrink-0 items-center gap-2">
                        {canPromote ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRoleChange(member, "admin");
                            }}
                            disabled={busyMemberId === member.user_id}
                            aria-label={`Promote ${member.name} to admin`}
                            className="motion-lift inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] text-xs font-semibold text-white transition-[transform,background-color,box-shadow] duration-200 hover:bg-[var(--color-primary-hover)] disabled:opacity-60 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
                          >
                            <ArrowUpIcon className="size-4" />
                            <span className="hidden sm:inline">Promote</span>
                          </button>
                        ) : null}
                        {canDemote ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRoleChange(member, "member");
                            }}
                            disabled={busyMemberId === member.user_id}
                            aria-label={`Demote ${member.name} to member`}
                            className="motion-lift inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-level-2)] text-xs font-semibold text-[var(--color-text-card)] transition-[transform,background-color,border-color,box-shadow] duration-200 hover:border-[var(--color-focus)] hover:bg-[var(--color-surface-secondary)] disabled:opacity-60 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
                          >
                            <ArrowDownIcon className="size-4" />
                            <span className="hidden sm:inline">Demote</span>
                          </button>
                        ) : null}
                        {canManage ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMemberPendingKick(member);
                            }}
                            disabled={busyMemberId === member.user_id}
                            aria-label={`Remove ${member.name} from group`}
                            className="motion-lift inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-error)] bg-[var(--color-error-soft)] text-xs font-semibold text-[var(--color-error)] transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:bg-[var(--color-error)] hover:text-white disabled:opacity-60 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
                          >
                            <TrashIcon className="size-4" />
                            <span className="hidden sm:inline">Kick</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {members.length > 5 ? (
              <button
                type="button"
                aria-expanded={areAllMembersVisible}
                onClick={() => setAreAllMembersVisible((current) => !current)}
                className="motion-lift w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-primary)] transition-[transform,border-color,background-color] duration-200 hover:border-cyan-300 hover:bg-cyan-50/60 xl:hidden"
              >
                {areAllMembersVisible ? "Show fewer members" : `See all members (${members.length})`}
              </button>
            ) : null}
          </div>
        </Card>

        <Card className="motion-fade-up motion-delay-2 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Schedule overlap</div>
              <div className="mt-1 text-sm text-slate-500">
                Compare one of your schedules with this group's members to see current and past class overlap.
              </div>
            </div>
            {selectedSchedule ? <Badge tone="blue">{formatScheduleLabel(selectedSchedule)}</Badge> : null}
          </div>

          {schedules.length ? (
            <GroupSchedulePicker schedules={schedules} selectedKey={selectedKey} onChange={setSelectedKey} />
          ) : (
            <EmptyState
              title="No schedules to compare"
              description="Add a schedule first so ClassMatch can show overlap between your courses and this group."
              action={<Link to="/schedule" className={buttonStyles({ variant: "primary", size: "md" })}>Go to schedules</Link>}
              className="shadow-none"
            />
          )}

          {schedules.length ? (
            isLoadingSchedule ? (
              <LoadingState title="Loading overlap" description="Checking which groupmates match your current schedule." />
            ) : normalizedClasses.length ? (
              <div className="grid gap-4">
                {normalizedClasses.map((course) => (
                  <button
                    key={`${course.sectionId}-${course.crn}`}
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                    className="motion-lift w-full rounded-[var(--radius-card)] border border-[var(--color-border)] !bg-[var(--color-surface-level-2)] p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:border-cyan-300 hover:!bg-[var(--color-surface-secondary)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{course.title}</div>
                        <div className="mt-1 text-sm font-medium text-slate-500">{formatCourseCode(course)} - Section {course.section || "TBA"} - CRN {course.crn}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="blue">{course.currentClassmates.length} current</Badge>
                        <Badge tone="neutral">{course.pastClassmates.length} past</Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Meeting</div>
                        <div className="mt-1 font-medium text-slate-700">{formatTimeRange(course.startTime, course.endTime)}</div>
                        <div className="text-xs text-slate-400">{course.daysOfWeek || "Days arranged"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Instructor</div>
                        <div className="mt-1 font-medium text-slate-700">{course.instructor || "Not listed"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current classmates</div>
                        <div className="mt-2">
                          <AvatarStack people={course.currentClassmates} label="current classmates" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No classes in this schedule"
                description="Choose another schedule or add classes before comparing against this group."
                className="shadow-none"
              />
            )
          ) : null}
        </Card>
      </div>

      <MemberProfileModal
        member={selectedMember}
        profile={selectedMemberProfile}
        isOpen={Boolean(selectedMember)}
        isLoading={isSelectedMemberProfileLoading}
        error={selectedMemberProfileError}
        onClose={() => setSelectedMember(null)}
      />
      <ClassDetailsModal course={selectedCourse} isOpen={Boolean(selectedCourse)} onClose={() => setSelectedCourse(null)} />
      <KickMemberModal
        group={group}
        member={memberPendingKick}
        isOpen={Boolean(memberPendingKick)}
        onClose={() => setMemberPendingKick(null)}
        onConfirm={handleKickConfirm}
        isRemoving={Boolean(memberPendingKick && busyMemberId === memberPendingKick.user_id)}
      />
      <EditGroupModal
        group={group}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdateGroup}
        isSubmitting={isSavingGroup}
      />
      <LeaveGroupModal
        group={group}
        isOpen={isLeaveOpen}
        onClose={() => setIsLeaveOpen(false)}
        onConfirm={handleLeaveGroup}
      />
    </div>
  );
}

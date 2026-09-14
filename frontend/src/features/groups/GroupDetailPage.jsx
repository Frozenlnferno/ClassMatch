import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useSession from "../../utils/useSession.js";
import {
  changeMemberRole,
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
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  buttonStyles,
} from "../../components/ui.jsx";
import { CopyIcon } from "../../components/icons.jsx";
import {
  buildInviteLink,
  canManageMember,
  copyText,
  formatCourseCode,
  formatScheduleLabel,
  formatTimeRange,
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
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
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

      const currentSelectedKey = selectedKeyRef.current;
      const desiredKey = nextSelectedKey && schedulesResponse.some((schedule) => getScheduleKey(schedule) === nextSelectedKey)
        ? nextSelectedKey
        : currentSelectedKey && schedulesResponse.some((schedule) => getScheduleKey(schedule) === currentSelectedKey)
          ? currentSelectedKey
          : schedulesResponse[0]
            ? getScheduleKey(schedulesResponse[0])
            : "";
      setSelectedKey(desiredKey);
      return desiredKey;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load group");
      return "";
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, [groupId]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    loadScheduleOverlap(selectedSchedule);
  }, [loadScheduleOverlap, selectedSchedule]);

  async function handleCopyInvite() {
    if (!group?.join_code) return;
    try {
      await copyText(buildInviteLink(group.join_code));
      setSuccess("Invite link copied.");
      setError("");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Unable to copy invite link");
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
      setSuccess(`${member.name} is now ${newRole}.`);
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
      <Card className="motion-fade-up motion-delay-1 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Group details</div>

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
                <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Join code {group.join_code}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            {canEditGroup ? <Button variant="secondary" onClick={() => setIsEditOpen(true)}>Edit group</Button> : null}
            <Button variant="ghost" onClick={handleCopyInvite}>
              <CopyIcon className="size-4" />
              Copy invite link
            </Button>
            <Button variant="danger" onClick={() => setIsLeaveOpen(true)}>
              Leave group
            </Button>
          </div>
        </div>
      </Card>

      <Card className="motion-fade-up motion-delay-1 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Group bio</div>
        <p className="text-sm leading-6 text-slate-600 sm:text-base">
          {displayedBio}
        </p>
        {shouldTruncateBio ? (
          <button
            type="button"
            onClick={() => setIsBioExpanded((current) => !current)}
            className="w-fit text-sm font-semibold text-blue-600 transition hover:text-blue-700"
          >
            {isBioExpanded ? "Show less" : "See all"}
          </button>
        ) : null}
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
            {members.map((member) => {
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
                  className="motion-lift w-full rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div
                    className={[
                      "flex flex-col items-start gap-3 sm:flex-row sm:items-center",
                      hasMemberActions ? "sm:justify-between" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <Avatar src={member.avatar_url} name={member.name} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{member.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </div>
                      </div>
                    </div>
                    {hasMemberActions ? (
                      <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:justify-end sm:overflow-visible sm:pb-0">
                        {canPromote ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRoleChange(member, "admin");
                            }}
                            disabled={busyMemberId === member.user_id}
                            className="motion-lift shrink-0 rounded-2xl bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 transition-[transform,background-color,box-shadow] duration-200 hover:bg-blue-200 disabled:opacity-60"
                          >
                            Promote
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
                            className="motion-lift shrink-0 rounded-2xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-[transform,background-color,box-shadow] duration-200 hover:bg-slate-300 disabled:opacity-60"
                          >
                            Demote
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
                            className="motion-lift shrink-0 rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition-[transform,background-color,box-shadow] duration-200 hover:bg-rose-200 disabled:opacity-60"
                          >
                            Kick
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
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
                    className="motion-lift w-full rounded-[28px] border border-slate-200 bg-white p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:border-blue-200 hover:bg-blue-50/30"
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
                        <div className="mt-1 font-medium text-slate-700">
                          {course.currentClassmates.length
                            ? course.currentClassmates.map((match) => match.member_name).join(", ")
                            : "No current overlap"}
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

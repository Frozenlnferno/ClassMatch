import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createGroup, getUserGroups, joinGroup } from "./groupService.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "../../components/ui.jsx";
import { ArrowRightIcon, PlusIcon, UsersIcon } from "../../components/icons.jsx";
import CreateGroupModal from "./components/CreateGroupModal.jsx";
import JoinGroupModal from "./components/JoinGroupModal.jsx";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";

export default function MyGroupsPage() {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useNotifications();
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    refreshGroups();
  }, []);

  useEffect(() => {
    if (error) {
      notifyError("Group issue", error);
    }
  }, [error, notifyError]);

  useEffect(() => {
    if (success) {
      notifySuccess("Success", success);
    }
  }, [notifySuccess, success]);

  async function refreshGroups() {
    try {
      setIsLoading(true);
      setError("");
      const response = await getUserGroups();
      setGroups(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load groups");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateGroup(groupData) {
    try {
      setIsCreating(true);
      setError("");
      setSuccess("");
      await createGroup(groupData);
      await refreshGroups();
      setIsCreateOpen(false);
      setSuccess("Group created. Open the group to create and share an invite link.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinGroup(nextJoinCode) {
    try {
      setIsJoining(true);
      setError("");
      setSuccess("");
      const response = await joinGroup(nextJoinCode.trim());
      setIsJoinOpen(false);
      notifySuccess(
        response.already_member ? "Already in group" : "Group joined",
        response.already_member ? "Opening the group you already belong to." : "Taking you to your new group.",
      );
      navigate(`/groups/${response.group_id}`, { replace: true });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join group");
      throw joinError;
    } finally {
      setIsJoining(false);
    }
  }

  function openGroup(groupId) {
    navigate(`/groups/${groupId}`);
  }

  return (
    <div className="motion-fade-up space-y-6">
      <PageHeader
        eyebrow="Groups"
        title="Your Groups"
        description="Create a new group, join by invite code, or jump back into the spaces you already share with classmates."
        actions={(
          <>
            <Button variant="secondary" onClick={() => setIsJoinOpen(true)}>
              <UsersIcon className="size-4" />
              Join group
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <PlusIcon className="size-4" />
              Create group
            </Button>
          </>
        )}
      />

      <Card className="motion-fade-up motion-delay-1 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">All groups</div>
            <div className="mt-1 text-sm text-slate-500">Each card includes your role, member count, and a sharable invite link.</div>
          </div>
          <Badge tone="blue">{groups.length} total</Badge>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-48 rounded-[28px] bg-slate-100" />
            ))}
          </div>
        ) : error && !groups.length ? (
          <EmptyState
            title="Couldn't load groups"
            description={error}
            action={<Button onClick={refreshGroups}>Try again</Button>}
          />
        ) : groups.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="motion-lift cursor-pointer rounded-[28px] p-5 shadow-md ring-1 ring-slate-100"
                role="link"
                tabIndex={0}
                onClick={() => openGroup(group.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openGroup(group.id);
                  }
                }}
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <Avatar src={group.group_icon_url} name={group.name} size="lg" />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge tone="neutral">{group.role}</Badge>
                        <Badge tone={group.joinable ? "emerald" : "amber"}>
                          {group.joinable ? "Open" : "Closed"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{group.name}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {group.member_count} members
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Link
                      to={`/groups/${group.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="motion-soft inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Open group
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No groups yet"
            description="Create your first group or join one with an invite code to start connecting course overlap with people you know."
            action={(
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" onClick={() => setIsJoinOpen(true)}>
                  <UsersIcon className="size-4" />
                  Join group
                </Button>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <PlusIcon className="size-4" />
                  Create a group
                </Button>
              </div>
            )}
          />
        )}
      </Card>

      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateGroup}
        isSubmitting={isCreating}
      />
      <JoinGroupModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onSubmit={handleJoinGroup}
        isSubmitting={isJoining}
      />
    </div>
  );
}

namespace CoreBlow.WindowsNode;

public sealed record NodeStatus(string State, int ActiveConnections)
{
    public bool CanOpenDashboard => State is "running" or "degraded";

    public static NodeStatus Normalize(string state, int activeConnections)
    {
        return new NodeStatus(state.Trim().ToLowerInvariant(), Math.Max(0, activeConnections));
    }
}

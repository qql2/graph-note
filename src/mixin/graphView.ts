import { CommonRelationshipTypes, GraphData, GraphNode, QuadrantConfig, RelationshipTypeConfig, defaultQuadrantConfig } from "../models/GraphNode";
import { GraphLayoutService } from "../services/GraphLayoutService";

export function getIndependentParentNode(nodeId: string, graphData: GraphData, config: RelationshipTypeConfig): GraphNode | null {
	let visited = new Set<string>();
	let stack = [nodeId];
	
	while (stack.length > 0) {
		let id = stack.pop()!;
		if (visited.has(id)) continue;
		visited.add(id);
		
		const currentNode = graphData.nodes.find(node => node.id === id);
		if (!currentNode) continue;
		
		// 如果找到了独立节点，直接返回
		if (currentNode.is_independent) {
			return currentNode;
		} else {
			// 获取可能的父节点ID数组，传递配置参数
			const parentNodes = getParentNode(currentNode.id, graphData, config);
			
			// 如果有多个候选父节点，按创建时间排序
			if (parentNodes.length > 0) {
				// 获取节点对象并记录创建时间
				const parentCandidates = parentNodes
					.map(pid => {
						const node = graphData.nodes.find(n => n.id === pid.id);
						if (!node) return null;
						
						// 获取创建时间
						const createdTime = node.metadata?.created_at || 
										  (node as any).created_at || 
										  new Date(0).toISOString();
						
						return {
							node,
							createdAt: new Date(createdTime)
						};
					})
					.filter(item => item !== null) as {node: GraphNode, createdAt: Date}[];
				
				// 按创建时间升序排序
				parentCandidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
				
				// 将排序后的父节点ID添加到堆栈中，最早创建的节点最先被访问
				const sortedParentIds = parentCandidates.map(item => item.node.id);
				stack.push(...sortedParentIds);
			}
		}
	}
	
	// 未找到独立父节点
	return null;
}

function getParentNode(nodeId: string, graphData: GraphData, config: RelationshipTypeConfig): GraphNode[] {
	// 如果缓存中已存在此节点的父节点信息，直接返回
	if (graphData.parentNodes && nodeId in graphData.parentNodes && graphData.parentNodes[nodeId]) {
		return [graphData.parentNodes[nodeId]];
	}
	
	// 获取当前节点
	const currentNode = graphData.nodes.find(node => node.id === nodeId);
	if (!currentNode || currentNode.is_independent) {
		return []; // 节点不存在或已是独立节点，返回空数组
	}
	
	// 获取与该节点相关的所有边
	const relatedEdges = graphData.edges.filter(edge => 
		edge.source === nodeId || edge.target === nodeId
	);
	
	// 潜在的父节点候选ID列表
	const parentIds: string[] = [];
	
	// 根据关系类型和方向确定父节点候选
	for (const edge of relatedEdges) {
		
		if (edge.target === nodeId) {
			if(edge.relationshipType === CommonRelationshipTypes.CHILD) parentIds.push(edge.source);
		} else if (edge.source === nodeId) {
			// 出边(当前节点 -> 其他节点)
			// 使用GraphLayoutService获取关系类型的相对类型
			const oppositeType = GraphLayoutService.getOppositeRelationType(edge.relationshipType, config);
			if(oppositeType === CommonRelationshipTypes.CHILD) parentIds.push(edge.target);
		}
	}
	
	return parentIds.map(id=>graphData.nodes.find(node=>node.id===id)).filter(node=>node!==undefined);
}



import React from 'react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';

interface Job {
  id: string;
  company: string;
  role: string;
  status: string;
  applied_date: string;
  type: string;
}

interface KanbanBoardProps {
  jobs: Job[];
  onStatusChange: (jobId: string, newStatus: string) => void;
}

const SortableItem = ({ job }: { job: Job }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: job.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-md shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing mb-3"
    >
      <h4 className="font-medium text-gray-900">{job.company}</h4>
      <p className="text-sm text-gray-600">{job.role}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{format(new Date(job.applied_date), 'MMM d')}</span>
        <span>{job.type}</span>
      </div>
    </div>
  );
};

const DroppableColumn = ({ status, jobs }: { status: string, jobs: Job[] }) => {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div ref={setNodeRef} className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[500px]">
      <h3 className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
        {status}
        <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
          {jobs.length}
        </span>
      </h3>
      <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
        {jobs.map(job => (
          <SortableItem key={job.id} job={job} />
        ))}
      </SortableContext>
    </div>
  );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ jobs, onStatusChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the job being dragged
    const job = jobs.find(j => j.id === activeId);
    if (!job) return;

    // If dropped over a column (status)
    if (['Applied', 'Interview', 'Offer', 'Rejected'].includes(overId)) {
      if (job.status !== overId) {
        onStatusChange(activeId, overId);
      }
    } else {
      // If dropped over another item, find its status
      const overJob = jobs.find(j => j.id === overId);
      if (overJob && job.status !== overJob.status) {
        onStatusChange(activeId, overJob.status);
      }
    }
  };

  const columns = ['Applied', 'Interview', 'Offer', 'Rejected'];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map(status => (
          <DroppableColumn key={status} status={status} jobs={jobs.filter(j => j.status === status)} />
        ))}
      </div>
    </DndContext>
  );
};

export default KanbanBoard;

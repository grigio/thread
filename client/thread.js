

paper.install(window);

Paths = new Meteor.Collection("paths");


//router to handle setting the position and browser history

var Router = Backbone.Router.extend({

	routes: {

		":x,:y": "position", // #go to a coordinate
	},

	position: function(x,y) {
		
		eval("var point = new Point(" + x + ',' + y + ")");
		
		console.log('location: ' + point);

		self.set_position(point);
	}
});

var router = new Router;

Meteor.startup(function () {

//  Backbone.history.start({pushState: true});

});

Template.header.rendered = function () {
	
	var canvas = $('#logo');
	
	canvas.svg();
	
	var svg = canvas.svg('get');
	
	svg.circle(30, 30, 20, {fill: 'none', stroke: 'red', strokeWidth: 1});
};

Template.header.events({
	
	'click #logo': function(event){

		projects[1].activeLayer.removeChildren();

		Paths.remove({}); 
	},

	'touchstart h1, click h1': function(event){

		event.preventDefault();
		event.stopPropagation();

		projects[0].activeLayer.position = new Point(0,0);
		projects[1].activeLayer.position = new Point(0,0);

		projects[0].view.zoom = 1;
		projects[1].view.zoom = 1;
	},

	
});

Template.canvas.events({

	'touchstart .tool, click .tool': function(event){

		event.preventDefault();
		event.stopPropagation();

		var current_tool = $(event.currentTarget);

		var tool_id = current_tool.attr('id');

		$('#tools li').removeClass('selected');

		current_tool.addClass('selected');

		project.activeLayer.selected = false;

		self.selected_item = false;

		var $canvas = $('#canvas');

		project.view.draw();

		if(tool_id == 'select_tool'){

			$canvas.hide();

		}else{

			$canvas.show();
			
		}

		eval('self.' + tool_id + '.activate()');

		self.update_selection_tools();
	},

	'touchstart #selection_delete, click #selection_delete': function(event){

		event.preventDefault();
		event.stopPropagation();

		if(self.selected_item){

			var id = self.selected_item.__id;

			self.selected_item = false;

			self.update_selection_tools();

			Paths.remove({_id:id});

			
		}
	}
});

Template.canvas.rendered = function () {

	paper.setup('canvas');
	paper.setup('canvas2');

	var $canvas = $('#canvas');
	var $canvas2 = $('#canvas2');


	self.selected_item = false;

	var $selection_tools = $('#selection_tools');

	self.update_selection_tools = function(){

		var offset = projects[0].activeLayer.position;

		if(self.selected_item && self.selected_item.selected){

			$selection_tools.show();

			$selection_tools.css('top', self.selected_item.bounds.y + $canvas.height()/2 + offset.y);

			$selection_tools.css('left', self.selected_item.bounds.right + $canvas.width()/2 + offset.x);

		}else{

			$selection_tools.hide();
		}
	}

	// push the current location onto the browser history stack

	self.push_position_history = function(){

		var point = projects[0].activeLayer.position.round();	

		var point_text = point.x + ',' + point.y;

		router.navigate(point_text, {trigger: false});
	}

	//reposition the canvas to a point

	self.set_position = function(point){

		projects[0].activeLayer.setPosition(point);
		projects[1].activeLayer.setPosition(point);

		self.update_selection_tools();

		projects[0].view.draw();
		projects[1].view.draw();
	}

	//reposition the canvas by a set amount

	self.translate_canvas = function(delta){

		projects[0].activeLayer.translate(delta);
		projects[1].activeLayer.translate(delta);

		self.update_selection_tools();

		projects[0].view.draw();
		projects[1].view.draw();
	}


	self.resize_view = function(){

		//$canvas[0].getContext('2d').scale(0.5,0.5);
		//$canvas2[0].getContext('2d').scale(0.5,0.5);

		/*
		var w1 = $canvas.attr('width');
		var h1 = $canvas.attr('height');

		$canvas.attr('width', w1*2);
		$canvas.attr('height', h1*2);

		$canvas2.attr('width', w1*2);
		$canvas2.attr('height', h1*2);
		*/

		var point = new Point(0,0);

		projects[0].view.center = point;
		projects[1].view.center = point;

		//projects[0].view.zoom = 2;
		//projects[1].view.zoom = 2;
	}

	self.resize_view();
	
	projects[0].view.onResize = function(event) {
    	
		self.resize_view();
	}

	projects[1].view.onResize = function(event) {
    	
		self.resize_view();
	}


	projects[0].activate();
	
	self.set_position(new Point(0,0));

	console.log('canvas rendered');


	//start the history to set the inital position based on url

	Backbone.history.start({pushState: true});


	//used to keep track of paths by id or by path shape:
	var path_pointers = {}
	var active_path_pointers = {}



	// drawing tool:

	self.draw_tool = new Tool();
	var path;
	var offset;

	// Define a mousedown and mousedrag handler
	self.draw_tool.onMouseDown = function(event) {
		
		projects[0].activate();

		offset = projects[0].activeLayer.position;

		event.preventDefault();

		path = new Path();
		 
		path.strokeColor = 'red';

		path.add(event.point.subtract(offset));

		projects[0].view.draw();
	}

	self.draw_tool.onMouseDrag = function(event) {
		
		event.preventDefault();

		projects[0].activate();

		path.add(event.point.subtract(offset));

		projects[0].view.draw();
	}

	self.draw_tool.onMouseUp = function(event) {
		
		projects[0].activate();

		// When the mouse is released, simplify it:
				
		path.simplify(10);
		
		var p = path.exportSvg();
		
		var d = $(p).attr('d');
		
		active_path_pointers[d] = path;

		self.savePath(path,d);

		
	}

	//select tool

	self.select_tool = new Tool();
	var hitOptions = {
		segments: true,
		stroke: true,
		fill: true,
		tolerance: 5
	};

	var segment, path;
	var movePath = false;
	
	

	self.select_tool.onMouseDown = function(event) {
			
		event.preventDefault();

		var selected_item = self.selected_item;

		offset = projects[0].activeLayer.position;

		segment = path = null;

		var hitResult = project.hitTest(event.point, hitOptions);

		if (hitResult && hitResult.item){

			if(self.selected_item == hitResult.item){

				console.log('same_item');

				if (event.modifiers.shift) {

					if (hitResult.type == 'segment') {
							hitResult.segment.remove();
							movePath = false;
					};
					return;
				}

				if (hitResult) {
					path = hitResult.item;
					self.selected_item = path;
					if (hitResult.type == 'segment') {
							segment = hitResult.segment;
							movePath = false;
					} else if (hitResult.type == 'stroke') {
							var location = hitResult.location;
							segment = path.insert(location.index + 1, event.point.subtract(offset));
							movePath = false;
							//path.smooth();
					}
				}

			}else{

				if(self.selected_item){

					if(self.selected_item.bounds.contains(event.point.subtract(offset))){

						console.log('inside bounds');
					}

					self.savePath(selected_item);
				}

				console.log('different_item');

				project.activeLayer.selected = false;

				self.selected_item = hitResult.item;

				movePath = self.selected_item;

				self.selected_item.selected = true;

				console.log(selected_item._id);

			}
		}else{

			//nothing under the cursor

			if(self.selected_item){

				if(self.selected_item.bounds.contains(event.point.subtract(offset))){

					console.log('inside bounds');
					
					movePath = self.selected_item;
				
				}else{

					self.savePath(selected_item);

					project.activeLayer.selected = false;

					self.selected_item = false;

					movePath = false;
				}

			}else{

				project.activeLayer.selected = false;

				self.selected_item = false;

				movePath = false;
			}

			
		}

		self.update_selection_tools();
	}
	
	self.select_tool.onMouseMove = function(event) {
		 
		projects[1].activate();

		if(!self.selected_item){

			var hitResult = project.hitTest(event.point, hitOptions);
			
			project.activeLayer.selected = false;
			
			self.selected_item = false;

			if (hitResult && hitResult.item){
				 	
				hitResult.item.selected = true;
			}
		}

		self.update_selection_tools();
	}

	self.select_tool.onMouseDrag = function(event) {

		projects[1].activate();

		event.preventDefault();

		console.log('draging: ' + event.delta);
		console.log('movePath: ' + movePath);

		if (segment) {

			segment.point = event.point.subtract(offset);
		}

		if (movePath){

			console.log('movePath: ' + movePath.position);

			movePath.position = movePath.position.add(event.delta);

		}

		self.update_selection_tools();
	}

	
	//move tool:

	projects[0].activate;

	self.move_tool = new Tool();

	self.move_tool.onMouseDown = function(event) {

		console.log(projects[0].activeLayer.position);
		console.log(projects[1].activeLayer.position);

		projects[0].activate;

		event.preventDefault();
	}

	self.move_tool.onMouseDrag = function(event) {

		projects[0].activate;

		event.preventDefault();

		self.translate_canvas(event.delta);
	}

	self.move_tool.onMouseUp = function(event) {

		self.push_position_history();
	}

	self.move_tool.activate();




	//window scrolling - also repositions the canvas

	self.scroll_speed = 0.4;
	self.scroll_timer = false;

	$(window).bind('mousewheel', function(e){

		e.preventDefault();

		var wheel = e.originalEvent;

		if(wheel && wheel.wheelDelta){

			e.preventDefault();	

			var delta = new Point(wheel.wheelDeltaX*self.scroll_speed,wheel.wheelDeltaY*self.scroll_speed);

			self.translate_canvas(delta);

			clearTimeout(self.scroll_timer);

			self.scroll_timer = setTimeout( self.push_position_history , 150 );
		}
    });

	$('body').on('keydown', function(event){ 
    	
		console.log("key" + event.which);

		if(event.which == 8 && selected_item){

			event.preventDefault();

			Paths.remove({_id:self.selected_item.__id});

			self.selected_item = false;
    	}

    	if(event.which == 187){

    		projects[0].view.zoom += 0.5;
    		projects[1].view.zoom += 0.5;

    		projects[0].view.center = new Point(0,0);
			projects[1].view.center = new Point(0,0);
    	}

    	if(event.which == 189){

    		projects[0].view.zoom = 1;
    		projects[1].view.zoom = 1;

    		projects[0].view.center = new Point(0,0);
			projects[1].view.center = new Point(0,0);
    	}
    });	




	
	
	//redraw whenever the data changes
	self.drawCanvas = Meteor.subscribe("allpaths", function() {
		
		console.log('subscription ready');

		projects[1].activate();

		var path = new Path();
		
		path.strokeColor = 'red';
		path.add(new Point(0,0));
		path.add(new Point(0,5));
		path.add(new Point(10,10));
		path.smooth();
		
		var p = path.exportSvg();
		
		path.remove();
		
		
		projects[1].activeLayer.removeChildren();

		//layer1.removeChildren();
		
		var paths = Paths.find();

		var handle = paths.observe({

			added: function (path_data) {

				console.log('added ' + path_data._id + ' : ' + path_data.d);

				projects[1].activate();

				var d = path_data.d;
		
				$(p).attr('d', d);
			
				$(p).attr('style', 'fill: none; stroke: red; stroke-width: 1');
					
				var path = project.importSvg($(p)[0]);
				
				path.__id = path_data._id;

				path_pointers[path_data._id] = path;

				if(active_path_pointers[d]){

					console.log('remove from drawing layer');

					active_path_pointers[d].remove();
				};

				projects[1].view.draw();
				projects[0].view.draw();

			},

			changed: function(path_data, index, old_path_data){

				if(old_path_data.d != path_data.d){

					console.log('updated ' + path_data._id + ' : ' + path_data.d);

					projects[1].activate();

					var path = path_pointers[path_data._id];

					if(path){

						path.remove();	
					}
				
					var d = path_data.d;
			
					$(p).attr('d', d);
				
					$(p).attr('style', 'fill: none; stroke: red; stroke-width: 1');
						
					path = project.importSvg($(p)[0]);
					
					path.__id = path_data._id;

					path_pointers[path_data._id] = path;

					projects[1].view.draw();
				}

			},

			removed: function (path_data) {
				
				console.log('removed ' + path_data.d);

				var path = path_pointers[path_data._id];

				if(path){
					
					path.remove();	
				}

				projects[1].view.draw();
				
			}
		});
	});
	
	
	self.savePath = function(path, d){

		if(!d){

			var p = path.exportSvg();
			
			d = $(p).attr('d');
		}
		
		var id = path.__id;

		var bounds = path.bounds;

		var values = {
			d:d,
			x:bounds.x,
			y:bounds.y,
			x2:bounds.x + bounds.width,
			y2:bounds.y + bounds.height,
			width:bounds.width,
			height:bounds.height
		}

		if(id){

			Paths.update({_id:id}, {$set: values}, function(err){});

		}else{

			Paths.insert(values, function(id,err){
				path.__id = id;
			});
		}
	}

	

}


Accounts.ui.config({
	requestPermissions: {
		facebook: ['user_likes'],
	},
	passwordSignupFields: 'EMAIL_ONLY'
});


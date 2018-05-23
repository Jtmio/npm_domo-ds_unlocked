module.exports = {
  lineUp: function(count){
    return '\033['+count+'A';
  },lineDown: function(count){
    return '\033['+count+'B';
  },cursorRight: function(count){
    return '\033['+count+'C';
  },cursorLeft: function(count){
    return '\033['+count+'D';
  },clearScreen: function(){
    return '\033[2J';
  },clearRight: function(){
    return '\033[K';
  },clearLeft: function(){
    return '\033[1K';
  },clearLine: function(){
    return '\033[2K';
  }
}

